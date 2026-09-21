import Stripe from 'stripe';
import { DateTime } from 'luxon';
import { getPool } from '../lib/db';
import { requireClerkUser } from '../lib/auth';
import { cleanText, isUuid, json, rateLimit, sameOrigin, validEmail } from '../lib/http';
import { holdExternalSlot, releaseExternalHold } from '../lib/providers';

let stripeClient: Stripe | null = null;
function getStripe(secret: string) {
  return stripeClient ??= new Stripe(secret);
}

function parseIso(value: unknown) {
  const text = cleanText(value, 64);
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(text)) throw new Error('INVALID_DATETIME');
  const parsed = DateTime.fromISO(text, { setZone: true });
  if (!parsed.isValid) throw new Error('INVALID_DATETIME');
  return parsed;
}

function dbCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error ? String((error as any).code) : '';
}

export default async (request: Request) => {
  if (request.method !== 'POST') return json(405, { error: 'Only POST is allowed.' }, { allow: 'POST' });
  if (!sameOrigin(request)) return json(403, { error: 'Cross-origin request blocked.' });
  const limited = rateLimit(request, 12, 60_000, 'booking-checkout');
  if (limited) return limited;
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 32_000) return json(413, { error: 'Request is too large.' });

  let auth;
  try { auth = await requireClerkUser(request); }
  catch (error) {
    if (error instanceof Error && error.message === 'CLERK_NOT_CONFIGURED') return json(503, { error: 'Authentication is not configured on the server.' });
    return json(401, { error: 'Please sign in before booking.' });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return json(500, { error: 'Stripe is not configured.' });

  let body: any;
  try { body = await request.json(); } catch { return json(400, { error: 'Invalid JSON body.' }); }
  const courtId = cleanText(body?.court_id, 120);
  if (!isUuid(courtId)) return json(400, { error: 'Invalid court_id.' });

  let startInput: DateTime;
  let endInput: DateTime;
  try {
    startInput = parseIso(body?.start_time);
    endInput = parseIso(body?.end_time);
  } catch { return json(400, { error: 'Invalid start or end time.', code: 'INVALID_DATETIME' }); }

  const durationValue = endInput.diff(startInput, 'minutes').minutes;
  if (!Number.isInteger(durationValue)) return json(400, { error: 'Booking times must use whole minutes.', code: 'INVALID_DATETIME' });
  const durationMinutes = Number(durationValue);
  if (durationMinutes <= 0 || durationMinutes > 8 * 60) return json(400, { error: 'Invalid booking period.' });
  if (startInput.toMillis() < Date.now() - 30_000) return json(400, { error: 'That booking time has already passed.' });

  const requestedEmail = cleanText(body?.user?.email, 320).toLowerCase();
  const customer = {
    email: auth.email || requestedEmail,
    firstName: cleanText(body?.user?.first_name || body?.user?.firstName, 100) || auth.firstName,
    lastName: cleanText(body?.user?.last_name || body?.user?.lastName, 100) || auth.lastName,
  };
  if (!auth.email) return json(409, { error: 'Your account needs an email address before you can book.' });
  if (requestedEmail && requestedEmail !== auth.email) return json(400, { error: 'The booking email must match your signed-in account.' });
  if (!validEmail(customer.email) || !customer.firstName || !customer.lastName) return json(400, { error: 'Name and valid email are required.' });

  const suppliedRequestKey = cleanText(request.headers.get('idempotency-key') || body?.idempotency_key, 120);
  if (suppliedRequestKey && !/^[A-Za-z0-9._:-]{8,120}$/.test(suppliedRequestKey)) return json(400, { error: 'Invalid idempotency key.' });
  const requestKey = suppliedRequestKey || `${courtId}:${startInput.toUTC().toISO()}:${endInput.toUTC().toISO()}`;
  const pool = getPool();
  const client = await pool.connect();
  let externalHold: { provider: string; externalId: string; holdId: string } | null = null;
  let bookingId = '';
  let createdPaymentIntent: Stripe.PaymentIntent | null = null;
  let bookingCreated = false;
  let effectiveHoldExpiresAt: Date | null = null;

  try {
    await client.query('BEGIN');
    const courtResult = await client.query(`
      SELECT c.id, c.name AS court_name, c.hourly_price_cents, c.slot_minutes, c.open_time, c.close_time, c.active,
             c.external_id AS court_external_id, v.id AS venue_id, v.name AS venue_name,
             v.provider, v.external_id, v.timezone
      FROM courts c JOIN venues v ON v.id = c.venue_id
      WHERE c.id = $1 LIMIT 1
      FOR UPDATE OF c
    `, [courtId]);
    if (!courtResult.rowCount || !courtResult.rows[0].active) throw new Error('COURT_NOT_FOUND');
    const court = courtResult.rows[0];
    if (court.provider !== 'manual' && !court.court_external_id) throw new Error('PROVIDER_COURT_ID_MISSING');
    const venueZone = court.timezone || 'Europe/Riga';
    const localStart = startInput.setZone(venueZone);
    const localEnd = endInput.setZone(venueZone);
    if (localStart.toISODate() !== localEnd.toISODate()) throw new Error('CROSS_DAY');
    if (localStart.toMillis() <= DateTime.now().setZone(venueZone).toMillis()) throw new Error('PAST_TIME');

    const open = DateTime.fromISO(`${localStart.toISODate()}T${String(court.open_time || '08:00:00').slice(0, 8)}`, { zone: venueZone });
    const close = DateTime.fromISO(`${localStart.toISODate()}T${String(court.close_time || '22:00:00').slice(0, 8)}`, { zone: venueZone });
    const slotMinutes = Number(court.slot_minutes) || 60;
    if (!open.isValid || !close.isValid || close <= open || localStart < open || localEnd > close || durationMinutes % slotMinutes !== 0) throw new Error('OUTSIDE_SCHEDULE');
    const offsetMinutes = Math.round(localStart.diff(open, 'minutes').minutes);
    if (offsetMinutes % slotMinutes !== 0) throw new Error('INVALID_SLOT_ALIGNMENT');

    // Serialize all availability mutations for this court/day so overlapping requests cannot race.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`court:${court.id}:${localStart.toISODate()}`]);

    const existingKey = await client.query(`
      SELECT id, stripe_payment_intent_id, status, hold_expires_at
      FROM bookings
      WHERE user_id = $1 AND client_request_key = $2
      LIMIT 1
    `, [auth.userId, requestKey]);
    if (existingKey.rowCount) {
      const existing = existingKey.rows[0];
      if (existing.status === 'confirmed') throw new Error('ALREADY_BOOKED');
      const activeHold = existing.status === 'pending' && existing.hold_expires_at && new Date(existing.hold_expires_at).getTime() > Date.now();
      if (existing.status === 'failed' || existing.status === 'cancelled') throw new Error('REQUEST_REUSED');
      if (activeHold && existing.stripe_payment_intent_id) {
        await client.query('COMMIT');
        const stripe = getStripe(secret);
        const intent = await stripe.paymentIntents.retrieve(String(existing.stripe_payment_intent_id));
        if (intent.status === 'succeeded') return json(200, { bookingId: String(existing.id), clientSecret: intent.client_secret, reused: true });
        if (['canceled', 'payment_failed'].includes(intent.status)) throw new Error('PAYMENT_NOT_REUSABLE');
        return json(200, {
          bookingId: String(existing.id),
          clientSecret: intent.client_secret,
          expiresAt: new Date(existing.hold_expires_at).toISOString(),
          reused: true,
        });
      }
      if (activeHold) throw new Error('REQUEST_IN_PROGRESS');
      if (existing.status === 'pending') {
        await client.query(`UPDATE bookings SET status = 'failed', stripe_payment_intent_id = NULL, external_hold_id = NULL, external_hold_expires_at = NULL, hold_expires_at = NOW() WHERE id = $1 AND status = 'pending'`, [existing.id]);
      }
    }

    const overlap = await client.query(`
      SELECT id FROM bookings
      WHERE court_id = $1
        AND (status = 'confirmed' OR (status = 'pending' AND hold_expires_at > NOW()))
        AND start_time < $2 AND end_time > $3
      LIMIT 1
    `, [court.id, endInput.toUTC().toJSDate(), startInput.toUTC().toJSDate()]);
    if (overlap.rowCount) throw new Error('SLOT_TAKEN');

    const priceCents = Math.round(Number(court.hourly_price_cents) * durationMinutes / 60);
    if (!Number.isSafeInteger(priceCents) || priceCents < 50) throw new Error('INVALID_PRICE');
    const holdExpiresAt = new Date(Date.now() + 5 * 60_000);
    const inserted = await client.query(`
      INSERT INTO bookings (court_id, venue_id, user_id, customer_email, customer_first_name, customer_last_name,
                            start_time, end_time, amount_cents, currency, status, hold_expires_at, client_request_key)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'eur','pending',$10,$11)
      RETURNING id
    `, [court.id, court.venue_id, auth.userId, customer.email, customer.firstName, customer.lastName, startInput.toUTC().toJSDate(), endInput.toUTC().toJSDate(), priceCents, holdExpiresAt, requestKey]);
    bookingId = String(inserted.rows[0].id);
    bookingCreated = true;
    await client.query('COMMIT');

    if (court.provider !== 'manual') {
      const held = await holdExternalSlot(court.provider, {
        externalId: String(court.external_id || ''), courtId: String(court.court_external_id || court.id), startTime: startInput.toUTC().toISO(), endTime: endInput.toUTC().toISO(),
        customer, venueId: String(court.venue_id), bookingId,
      });
      if (!held) throw new Error('EXTERNAL_HOLD_FAILED');
      externalHold = { provider: court.provider, externalId: String(court.external_id || ''), holdId: held.holdId };
      const providerExpiry = held.expiresAt ? new Date(held.expiresAt) : holdExpiresAt;
      effectiveHoldExpiresAt = new Date(Math.min(
        holdExpiresAt.getTime(),
        Number.isNaN(providerExpiry.getTime()) ? holdExpiresAt.getTime() : providerExpiry.getTime(),
      ));
      if (effectiveHoldExpiresAt.getTime() <= Date.now()) throw new Error('EXTERNAL_HOLD_EXPIRED');
      await pool.query(`UPDATE bookings SET external_hold_id = $1, external_hold_expires_at = $2, hold_expires_at = $2 WHERE id = $3 AND status = 'pending'`, [held.holdId, effectiveHoldExpiresAt, bookingId]);
    }

    const stripe = getStripe(secret);
    createdPaymentIntent = await stripe.paymentIntents.create({
      amount: priceCents,
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      metadata: { booking_id: bookingId, court_id: String(court.id), venue_id: String(court.venue_id) },
      description: `SportaBiedrs rezervācija — ${court.venue_name} — ${court.court_name}`,
      receipt_email: customer.email,
    }, { idempotencyKey: `booking-${bookingId}` });
    if (!createdPaymentIntent.client_secret) throw new Error('STRIPE_CLIENT_SECRET_MISSING');
    await pool.query(`UPDATE bookings SET stripe_payment_intent_id = $1 WHERE id = $2 AND status = 'pending'`, [createdPaymentIntent.id, bookingId]);

    return json(200, {
      bookingId,
      clientSecret: createdPaymentIntent.client_secret,
      expiresAt: (effectiveHoldExpiresAt || holdExpiresAt).toISOString(),
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (externalHold) await releaseExternalHold(externalHold.provider, externalHold.externalId, externalHold.holdId);
    if (createdPaymentIntent) await getStripe(secret).paymentIntents.cancel(createdPaymentIntent.id).catch(() => undefined);
    if (bookingCreated && bookingId) {
      await pool.query(`UPDATE bookings SET status = 'failed', hold_expires_at = NOW() WHERE id = $1 AND status = 'pending'`, [bookingId]).catch(() => undefined);
    }
    const code = error instanceof Error ? error.message : dbCode(error) || 'CHECKOUT_ERROR';
    const map: Record<string, [number, string]> = {
      COURT_NOT_FOUND: [404, 'Court not found.'],
      SLOT_TAKEN: [409, 'That time is no longer available.'],
      CROSS_DAY: [400, 'A booking cannot cross to the next day.'],
      PAST_TIME: [400, 'That booking time has already passed.'],
      OUTSIDE_SCHEDULE: [400, 'That time is outside the court schedule.'],
      INVALID_SLOT_ALIGNMENT: [400, 'Choose one of the available time slots.'],
      INVALID_PRICE: [400, 'The court price is not configured correctly.'],
      EXTERNAL_HOLD_FAILED: [409, 'The external provider could not hold that slot.'],
      PROVIDER_COURT_ID_MISSING: [409, 'This court is not fully connected to the external booking provider yet.'],
      EXTERNAL_HOLD_EXPIRED: [409, "The external provider's hold expired immediately. Please choose the slot again."],
      STRIPE_CLIENT_SECRET_MISSING: [502, 'Stripe did not return a client secret.'],
      ALREADY_BOOKED: [409, 'This booking request was already completed.'],
      REQUEST_REUSED: [409, 'This checkout request has already failed or been cancelled. Start a new checkout.'],
      REQUEST_IN_PROGRESS: [409, 'This checkout is already being prepared. Please wait a moment and try again.'],
      PAYMENT_NOT_REUSABLE: [409, 'That payment attempt is no longer active. Start a new checkout.'],
    };
    const [status, message] = map[code] || (dbCode(error) === '23505' ? [409, 'That booking request was already submitted.'] : [500, 'Could not create the booking payment.']);
    console.error('Booking checkout failed', { code, bookingId, stripePaymentIntentId: createdPaymentIntent?.id || null });
    return json(status, { error: message, code });
  } finally {
    client.release();
  }
};
