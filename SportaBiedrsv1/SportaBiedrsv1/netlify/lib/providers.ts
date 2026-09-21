import { cleanText } from './http';

export type Slot = { start: string; end: string; available: boolean; externalId?: string | null; courtId?: string | null };
export type BookingRequest = {
  externalId: string;
  courtId: string;
  startTime: string;
  endTime: string;
  customer: { email: string; firstName: string; lastName: string };
  venueId: string;
  bookingId?: string;
};
export type HoldResult = { holdId: string; expiresAt?: string };

function template(input: string, vars: Record<string, string>) {
  const rendered = input.replace(/\{(\w+)\}/g, (_, key) => {
    const value = String(vars[key] ?? '');
    // external_id is commonly a provider path such as /businesses/abc; keep path separators.
    return key === 'external_id' ? value.split('/').map(part => encodeURIComponent(part)).join('/') : encodeURIComponent(value);
  });
  const url = new URL(rendered);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Provider URL must use HTTP(S).');
  return url.toString();
}

function authHeaders(prefix: string): Record<string, string> {
  const key = process.env[`${prefix}_API_KEY`];
  return key ? { authorization: `Bearer ${key}`, accept: 'application/json', 'content-type': 'application/json' } : { accept: 'application/json', 'content-type': 'application/json' };
}

async function parseJson(response: Response) {
  const text = await response.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!response.ok) {
    const message = typeof body === 'object' ? body?.message || body?.error : body;
    throw new Error(`Provider request failed (${response.status}): ${cleanText(message, 300)}`);
  }
  return body;
}

function isoToTime(iso: string, timeZone = 'Europe/Riga') {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) throw new Error('Provider returned an invalid slot time.');
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

function addMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function mapBooklaPayload(body: any, timeZone = 'Europe/Riga'): Slot[] {
  // Supports a simple array and Bookla's documented availability shape: { times: { resourceId: [{startTime,duration}] } }.
  if (Array.isArray(body)) {
    return body.map((row: any) => {
      const startIso = row?.startTime || row?.start || row?.start_time;
      const endIso = row?.endTime || row?.end || row?.end_time || (row?.durationMinutes ? addMinutes(startIso, Number(row.durationMinutes)) : null);
      if (!startIso || !endIso) return null;
      return { start: isoToTime(startIso, timeZone), end: isoToTime(endIso, timeZone), available: row?.available !== false, externalId: String(row?.id || row?.resourceId || '') || undefined };
    }).filter(Boolean);
  }

  const result: Slot[] = [];
  const times = body?.times;
  if (times && typeof times === 'object') {
    for (const [resourceId, rows] of Object.entries(times)) {
      for (const row of Array.isArray(rows) ? rows : []) {
        const startIso = (row as any)?.startTime;
        const duration = String((row as any)?.duration || 'PT60M');
        const minutes = /PT(?:(\d+)H)?(?:(\d+)M)?/i.exec(duration);
        const durationMinutes = (Number(minutes?.[1] || 0) * 60) + Number(minutes?.[2] || 0) || 60;
        if (!startIso) continue;
        const endIso = addMinutes(startIso, durationMinutes);
        result.push({ start: isoToTime(startIso, timeZone), end: isoToTime(endIso, timeZone), available: true, externalId: resourceId });
      }
    }
  }
  return result;
}

export async function fetchBooklaSlots(externalId: string, date: string, timeZone = 'Europe/Riga'): Promise<Slot[]> {
  // The user's requested endpoint is supported via BOOKLA_SLOTS_URL_TEMPLATE.
  // Bookla's current public docs also expose a business-specific availability API,
  // so the template is intentionally configurable rather than hard-coded to an unverified path.
  const urlTemplate = process.env.BOOKLA_SLOTS_URL_TEMPLATE || 'https://bookla.com{external_id}/slots?date={date}';
  const url = template(urlTemplate, { external_id: externalId, date });
  const response = await fetch(url, { method: 'GET', headers: authHeaders('BOOKLA'), signal: AbortSignal.timeout(8_000) });
  const slots = mapBooklaPayload(await parseJson(response), timeZone);
  const unique = new Map<string, Slot>();
  for (const slot of slots) unique.set(`${slot.start}-${slot.end}-${slot.externalId || ''}`, slot);
  return [...unique.values()].sort((a,b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
}

export async function holdExternalSlot(provider: string, req: BookingRequest): Promise<HoldResult | null> {
  if (provider === 'manual') return null;
  const prefix = provider.toUpperCase();
  const urlTemplate = process.env[`${prefix}_HOLD_URL_TEMPLATE`];
  if (!urlTemplate) throw new Error(`${prefix}_HOLD_URL_TEMPLATE is not configured.`);
  const url = template(urlTemplate, { external_id: req.externalId, court_id: req.courtId, start_time: req.startTime, end_time: req.endTime, venue_id: req.venueId });
  const headers = authHeaders(prefix);
  if (req.bookingId) headers['idempotency-key'] = `sportabiedrs-booking-${req.bookingId}-hold`;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ courtId: req.courtId, startTime: req.startTime, endTime: req.endTime, customer: req.customer, holdMinutes: 5 }),
    signal: AbortSignal.timeout(10_000),
  });
  const body: any = await parseJson(response);
  const holdId = String(body?.holdId || body?.id || body?.reservationId || '');
  if (!holdId) throw new Error(`${provider} hold response did not include a hold ID.`);
  return { holdId, expiresAt: body?.expiresAt ? String(body.expiresAt) : new Date(Date.now() + 5 * 60_000).toISOString() };
}

export async function releaseExternalHold(provider: string, externalId: string, holdId: string) {
  const prefix = provider.toUpperCase();
  const urlTemplate = process.env[`${prefix}_RELEASE_URL_TEMPLATE`];
  if (!urlTemplate) return;
  const url = template(urlTemplate, { external_id: externalId, hold_id: holdId });
  try {
    await fetch(url, { method: 'POST', headers: authHeaders(prefix), body: JSON.stringify({ holdId }), signal: AbortSignal.timeout(8_000) });
  } catch (error) {
    console.error('External hold release failed', { provider, message: error instanceof Error ? error.message : String(error) });
  }
}

export async function finalizeExternalBooking(provider: string, req: BookingRequest & { holdId?: string | null }) {
  if (provider === 'manual') return;
  const prefix = provider.toUpperCase();
  const urlTemplate = process.env[`${prefix}_FINALIZE_URL_TEMPLATE`];
  if (!urlTemplate) throw new Error(`${prefix}_FINALIZE_URL_TEMPLATE is not configured.`);
  const url = template(urlTemplate, { external_id: req.externalId, court_id: req.courtId, start_time: req.startTime, end_time: req.endTime, venue_id: req.venueId, hold_id: req.holdId || '' });
  const headers = authHeaders(prefix);
  if (req.bookingId) headers['idempotency-key'] = `sportabiedrs-booking-${req.bookingId}-finalize`;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ holdId: req.holdId || undefined, courtId: req.courtId, startTime: req.startTime, endTime: req.endTime, customer: req.customer }),
    signal: AbortSignal.timeout(10_000),
  });
  const body: any = await parseJson(response);
  return String(body?.reservationId || body?.id || body?.bookingId || req.holdId || '');
}
