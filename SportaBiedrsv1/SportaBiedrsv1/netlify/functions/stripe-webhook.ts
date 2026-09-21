import Stripe from 'stripe';
import { getPool } from '../lib/db';
import { finalizeExternalBooking, releaseExternalHold } from '../lib/providers';
import { sendBookingConfirmation } from '../lib/email';
import { json } from '../lib/http';

const PAYMENT_EVENTS = new Set([
  'charge.succeeded',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
]);

let stripeClient: Stripe | null = null;
function getStripe(secret: string) {
  return stripeClient ??= new Stripe(secret);
}

export default async (request: Request) => {
  if (request.method !== 'POST') return json(405, { error: 'Only POST is allowed.' }, { allow: 'POST' });
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !webhookSecret) return json(500, { error: 'Stripe webhook is not configured.' });
  const signature = request.headers.get('stripe-signature');
  if (!signature) return json(400, { error: 'Missing Stripe signature.' });

  const rawBody = await request.text();
  const stripe = getStripe(secret);
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret); }
  catch (error) { console.error('Stripe webhook signature verification failed', error); return json(400, { error: 'Invalid Stripe signature.' }); }
  if (!PAYMENT_EVENTS.has(event.type)) return json(200, { received: true });

  const pool = getPool();
  const client = await pool.connect();
  let eventLock = false;
  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [`stripe-event:${event.id}`]);
    eventLock = true;

    const seen = await client.query(`SELECT event_id FROM stripe_webhook_events WHERE event_id = $1 LIMIT 1`, [event.id]);
    if (seen.rowCount) return json(200, { received: true, duplicate: true });

    const payload: any = event.data.object;
    const paymentIntentId = event.type === 'charge.succeeded' ? (typeof payload.payment_intent === 'string' ? payload.payment_intent : String(payload.payment_intent?.id || '')) : String(payload.id || '');
    if (!paymentIntentId) return json(200, { received: true });

    if (event.type === 'payment_intent.payment_failed' || event.type === 'payment_intent.canceled') {
      const bookingResult = await pool.query(`
        SELECT b.id, b.status, v.provider, v.external_id, b.external_hold_id
        FROM bookings b JOIN venues v ON v.id = b.venue_id
        WHERE b.stripe_payment_intent_id = $1 LIMIT 1
      `, [paymentIntentId]);
      const wasPending = bookingResult.rowCount === 1 && bookingResult.rows[0].status === 'pending';
      await pool.query(`UPDATE bookings SET status = 'failed', hold_expires_at = NOW() WHERE stripe_payment_intent_id = $1 AND status = 'pending'`, [paymentIntentId]);
      if (wasPending && bookingResult.rows[0].provider !== 'manual' && bookingResult.rows[0].external_hold_id) {
        await releaseExternalHold(String(bookingResult.rows[0].provider), String(bookingResult.rows[0].external_id || ''), String(bookingResult.rows[0].external_hold_id));
      }
      await pool.query(`INSERT INTO stripe_webhook_events (event_id, event_type) VALUES ($1,$2) ON CONFLICT (event_id) DO NOTHING`, [event.id, event.type]);
      return json(200, { received: true });
    }

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const bookingResult = await pool.query(`
      SELECT b.*, c.name AS court_name, c.external_id AS court_external_id, v.name AS venue_name, v.provider, v.external_id, v.timezone
      FROM bookings b
      JOIN courts c ON c.id = b.court_id
      JOIN venues v ON v.id = b.venue_id
      WHERE b.stripe_payment_intent_id = $1
      LIMIT 1
    `, [paymentIntentId]);
    if (!bookingResult.rowCount) return json(200, { received: true });
    const booking = bookingResult.rows[0];

    // A payment_intent.succeeded and charge.succeeded are distinct events; serialize by booking too.
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [`booking:${booking.id}`]);
    try {
      const fresh = await pool.query(`
        SELECT b.*, c.name AS court_name, c.external_id AS court_external_id, v.name AS venue_name, v.provider, v.external_id, v.timezone
        FROM bookings b
        JOIN courts c ON c.id = b.court_id
        JOIN venues v ON v.id = b.venue_id
        WHERE b.id = $1 LIMIT 1
      `, [booking.id]);
      if (!fresh.rowCount) return json(200, { received: true });
      const current = fresh.rows[0];

      if (
        intent.metadata?.booking_id !== String(current.id) ||
        intent.amount !== Number(current.amount_cents) ||
        intent.currency.trim().toLowerCase() !== String(current.currency).trim().toLowerCase()
      ) {
        console.error('Stripe amount/metadata mismatch', { paymentIntentId, bookingId: current.id });
        return json(400, { error: 'Payment does not match the booking.' });
      }

      if (current.status === 'pending' && current.hold_expires_at && new Date(current.hold_expires_at).getTime() <= Date.now()) {
        await pool.query(`UPDATE bookings SET status = 'failed', hold_expires_at = NOW() WHERE id = $1 AND status = 'pending'`, [current.id]);
        if (current.provider !== 'manual' && current.external_hold_id) {
          await releaseExternalHold(String(current.provider), String(current.external_id || ''), String(current.external_hold_id));
        }
        await stripe.refunds.create({ payment_intent: paymentIntentId }, { idempotencyKey: `booking-${current.id}-expired-refund` });
        await pool.query(`INSERT INTO stripe_webhook_events (event_id, event_type) VALUES ($1,$2) ON CONFLICT (event_id) DO NOTHING`, [event.id, event.type]);
        return json(200, { received: true, refunded: true, reason: 'booking_hold_expired' });
      }

      if (current.status !== 'confirmed') {
        await pool.query(`UPDATE bookings SET status = 'confirmed', confirmed_at = COALESCE(confirmed_at, NOW()) WHERE id = $1 AND status = 'pending'`, [current.id]);
      }

      if (current.provider !== 'manual' && current.external_confirmation_status !== 'confirmed') {
        try {
          await finalizeExternalBooking(current.provider, {
            externalId: String(current.external_id || ''), courtId: String(current.court_external_id || current.court_id), venueId: String(current.venue_id),
            startTime: new Date(current.start_time).toISOString(), endTime: new Date(current.end_time).toISOString(), holdId: current.external_hold_id, bookingId: String(current.id),
            customer: { email: current.customer_email, firstName: current.customer_first_name, lastName: current.customer_last_name },
          });
          await pool.query(`UPDATE bookings SET external_confirmation_status = 'confirmed' WHERE id = $1`, [current.id]);
        } catch (error) {
          await pool.query(`UPDATE bookings SET external_confirmation_status = 'failed' WHERE id = $1`, [current.id]);
          console.error('External finalization failed', { bookingId: current.id, message: error instanceof Error ? error.message : String(error) });
          return json(500, { error: 'Payment succeeded, but the venue reservation could not be finalized yet.' });
        }
      }

      const emailState = await pool.query(`SELECT confirmation_email_sent_at FROM bookings WHERE id = $1`, [current.id]);
      if (!emailState.rows[0]?.confirmation_email_sent_at) {
        try {
          const sent = await sendBookingConfirmation({
            to: current.customer_email,
            name: `${current.customer_first_name} ${current.customer_last_name}`.trim(),
            venueName: current.venue_name,
            courtName: current.court_name,
            startTime: new Intl.DateTimeFormat('lv-LV', { timeZone: current.timezone || 'Europe/Riga', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(current.start_time)),
            endTime: new Intl.DateTimeFormat('lv-LV', { timeZone: current.timezone || 'Europe/Riga', timeStyle: 'short' }).format(new Date(current.end_time)),
          });
          if (sent) await pool.query(`UPDATE bookings SET confirmation_email_sent_at = NOW() WHERE id = $1`, [current.id]);
        } catch (error) {
          console.error('Confirmation email failed', { bookingId: current.id, message: error instanceof Error ? error.message : String(error) });
        }
      }

      await pool.query(`INSERT INTO stripe_webhook_events (event_id, event_type) VALUES ($1,$2) ON CONFLICT (event_id) DO NOTHING`, [event.id, event.type]);
      return json(200, { received: true });
    } finally {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [`booking:${booking.id}`]).catch(() => undefined);
    }
  } catch (error) {
    console.error('Stripe webhook processing failed', error);
    return json(500, { error: 'Webhook processing failed. Stripe may retry the event.' });
  } finally {
    if (eventLock) await client.query('SELECT pg_advisory_unlock(hashtext($1))', [`stripe-event:${event.id}`]).catch(() => undefined);
    client.release();
  }
};
