import { DateTime } from 'luxon';
import { getPool } from '../lib/db';
import { json, rateLimit } from '../lib/http';
import { fetchBooklaSlots } from '../lib/providers';

function parseId(request: Request) {
  const url = new URL(request.url);
  return url.searchParams.get('id') || url.pathname.match(/\/api\/venues\/([^/]+)\/slots$/)?.[1] || '';
}

function validDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = DateTime.fromISO(date, { zone: 'Europe/Riga' });
  return parsed.isValid && parsed.toFormat('yyyy-MM-dd') === date;
}

export default async (request: Request) => {
  if (request.method !== 'GET') return json(405, { error: 'Only GET is allowed.' }, { allow: 'GET' });
  const limited = rateLimit(request, 120, 60_000, 'slots');
  if (limited) return limited;

  const url = new URL(request.url);
  const venueId = decodeURIComponent(parseId(request)).trim();
  const date = url.searchParams.get('date') || '';
  if (!venueId) return json(400, { error: 'Venue id is required.' });
  if (!validDate(date)) return json(400, { error: 'date must use a valid YYYY-MM-DD date.' });

  const pool = getPool();
  try {
    const venueResult = await pool.query(`
      SELECT v.id, v.name, v.provider, v.external_id, v.timezone
      FROM venues v WHERE v.id = $1 LIMIT 1
    `, [venueId]);
    if (!venueResult.rowCount) return json(404, { error: 'Venue not found.' });
    const venue = venueResult.rows[0];
    const zone = venue.timezone || 'Europe/Riga';

    if (venue.provider === 'bookla') {
      if (!venue.external_id) return json(409, { error: 'This venue is missing its external provider ID.' });
      const [slots, courts] = await Promise.all([
        fetchBooklaSlots(String(venue.external_id), date, zone),
        pool.query(`SELECT id, external_id FROM courts WHERE venue_id = $1 AND active = TRUE ORDER BY sort_order, id`, [venue.id]),
      ]);
      const byExternalCourt = new Map<string, string>();
      for (const court of courts.rows) if (court.external_id) byExternalCourt.set(String(court.external_id), String(court.id));
      const singleCourtId = courts.rowCount === 1 ? String(courts.rows[0].id) : undefined;
      return json(200, slots.filter(slot => slot.available !== false).map(slot => {
        const mappedCourtId = (slot.externalId && byExternalCourt.get(String(slot.externalId))) || singleCourtId;
        return mappedCourtId
          ? { start: slot.start, end: slot.end, available: true, courtId: mappedCourtId }
          : { start: slot.start, end: slot.end, available: true };
      }));
    }

    if (venue.provider !== 'manual') return json(501, { error: `Unsupported venue integration provider: ${venue.provider}` });

    const courts = await pool.query(`
      SELECT id, external_id, open_time, close_time, slot_minutes
      FROM courts WHERE venue_id = $1 AND active = TRUE ORDER BY sort_order, id
    `, [venue.id]);
    if (!courts.rowCount) return json(200, []);

    const courtIds = courts.rows.map(c => String(c.id));
    const earliest = courts.rows.reduce((value, court) => {
      const t = String(court.open_time || '08:00:00');
      return !value || t < value ? t : value;
    }, '');
    const latest = courts.rows.reduce((value, court) => {
      const t = String(court.close_time || '22:00:00');
      return !value || t > value ? t : value;
    }, '');
    const rangeStart = DateTime.fromISO(`${date}T${earliest || '00:00:00'}`, { zone }).toUTC();
    const rangeEnd = DateTime.fromISO(`${date}T${latest || '23:59:59'}`, { zone }).toUTC();
    const now = DateTime.now().setZone(zone);
    const bookings = await pool.query(`
      SELECT court_id, start_time, end_time
      FROM bookings
      WHERE court_id = ANY($1::uuid[])
        AND (status = 'confirmed' OR (status = 'pending' AND hold_expires_at > NOW()))
        AND start_time < $2 AND end_time > $3
    `, [courtIds, rangeEnd.toJSDate(), rangeStart.toJSDate()]);
    const byCourt = new Map<string, any[]>();
    for (const booking of bookings.rows) {
      const key = String(booking.court_id);
      const list = byCourt.get(key) || [];
      list.push(booking);
      byCourt.set(key, list);
    }

    const output: Array<{start: string; end: string; available: boolean; courtId: string}> = [];
    for (const court of courts.rows) {
      const openTime = String(court.open_time || '08:00:00').slice(0,8);
      const closeTime = String(court.close_time || '22:00:00').slice(0,8);
      const slotMinutes = Math.max(15, Math.min(240, Number(court.slot_minutes) || 60));
      let cursor = DateTime.fromISO(`${date}T${openTime}`, { zone });
      const close = DateTime.fromISO(`${date}T${closeTime}`, { zone });
      if (!cursor.isValid || !close.isValid || close <= cursor) continue;
      const courtBookings = byCourt.get(String(court.id)) || [];

      while (cursor.plus({ minutes: slotMinutes }) <= close) {
        const end = cursor.plus({ minutes: slotMinutes });
        const startUtc = cursor.toUTC();
        const endUtc = end.toUTC();
        const occupied = courtBookings.some((booking: any) =>
          new Date(booking.start_time).getTime() < endUtc.toMillis() &&
          new Date(booking.end_time).getTime() > startUtc.toMillis()
        );
        const inPast = startUtc.toMillis() <= Date.now();
        output.push({
          start: cursor.toFormat('HH:mm'),
          end: end.toFormat('HH:mm'),
          available: !occupied && !inPast,
          courtId: String(court.id),
        });
        cursor = end;
      }
    }

    return json(200, output.filter(slot => slot.available).map(({ start, end, courtId }) => ({ start, end, available: true, courtId })));
  } catch (error) {
    console.error('Venue slots error', error);
    return json(500, { error: 'Could not load available slots.' });
  }
};
