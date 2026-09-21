export async function sendBookingConfirmation(input: { to: string; name: string; venueName: string; courtName: string; startTime: string; endTime: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn('Confirmation email not sent: RESEND_API_KEY or EMAIL_FROM is not configured.');
    return false;
  }
  const html = `<!doctype html><html lang="lv"><body style="font-family:Arial,sans-serif;color:#171715"><h1>Rezervācija apstiprināta</h1><p>Sveiki, ${escapeHtml(input.name || 'sporta draugs')}!</p><p>Tava rezervācija ir apstiprināta.</p><p><strong>${escapeHtml(input.venueName)}</strong><br>${escapeHtml(input.courtName)}<br>${escapeHtml(input.startTime)}–${escapeHtml(input.endTime)}</p><p>Uz tikšanos sportā!</p></body></html>`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to: [input.to], subject: `SportaBiedrs — rezervācija apstiprināta`, html }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
  return true;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c] || c));
}
