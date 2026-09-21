import { getPool } from '../lib/db';
import { json, rateLimit } from '../lib/http';

export default async (request: Request) => {
  if (request.method !== 'GET') return json(405, { error: 'Only GET is allowed.' }, { allow: 'GET' });
  const limited = rateLimit(request, 120, 60_000, 'venues');
  if (limited) return limited;
  try {
    const result = await getPool().query(`
      SELECT
        v.id, v.name, v.city, v.address, v.provider, v.external_id, v.timezone,
        COALESCE(json_agg(
          json_build_object(
            'id', c.id,
            'name', c.name,
            'external_id', c.external_id,
            'hourly_price_cents', c.hourly_price_cents,
            'slot_minutes', c.slot_minutes
          ) ORDER BY c.sort_order, c.id
        ) FILTER (WHERE c.id IS NOT NULL), '[]'::json) AS courts
      FROM venues v
      LEFT JOIN courts c ON c.venue_id = v.id AND c.active = TRUE
      GROUP BY v.id
      ORDER BY v.name ASC
    `);
    return json(200, result.rows.map(row => ({
      id: String(row.id),
      name: String(row.name),
      city: row.city ? String(row.city) : '',
      address: row.address ? String(row.address) : '',
      provider: String(row.provider),
      externalId: row.external_id ? String(row.external_id) : null,
      timezone: String(row.timezone || 'Europe/Riga'),
      courts: Array.isArray(row.courts) ? row.courts : [],
    })));
  } catch (error) {
    console.error('Venue mapping error', error);
    return json(503, { error: 'Venue integrations are temporarily unavailable.' });
  }
};
