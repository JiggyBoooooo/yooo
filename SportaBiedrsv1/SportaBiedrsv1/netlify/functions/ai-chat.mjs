// Server-side only. Calls OpenAI on behalf of the chatbot and the demo
// direct-message partners. The API key is read from the Netlify environment
// (Site settings -> Environment variables -> OPENAI_API_KEY) and never sent
// to, or read from, the browser.

const json = (status, body, extraHeaders = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders }
});

const rateBuckets = globalThis.__sbAiChatRateBuckets ??= new Map();
const getClientKey = (req) => (req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim().slice(0, 120);
const rateLimit = (req, limit = 20, windowMs = 60_000) => {
  const now = Date.now();
  const key = getClientKey(req);
  const hit = rateBuckets.get(key);
  if (!hit || now - hit.started >= windowMs) { rateBuckets.set(key, { started: now, count: 1 }); return null; }
  hit.count += 1;
  if (hit.count > limit) return json(429, { error: 'Pārāk daudz pieprasījumu. Mēģini pēc mazliet.' });
  return null;
};

const LANG_NAME = { lv: 'Latvian', en: 'English', ru: 'Russian' };

function buildSystemPrompt(mode, lang, persona) {
  const langName = LANG_NAME[lang] || 'Latvian';
  const base = `Reply only in ${langName}. Keep replies short: 1-3 sentences, plain text, no markdown, no em dashes (use commas or periods instead).`;
  if (mode === 'partner' && persona) {
    return `${persona.context || `You are ${persona.name}, a friendly ${persona.sport} player in ${persona.city} (skill level: ${persona.level}) on the SportaBiedrs.lv sports-partner app.`} You are chatting with someone who wants to train together. Stay in character, be warm and casual, suggest only venues and products from the supplied platform data, and suggest concrete times, places or next steps. Never mention that you are an AI or a language model. ${base}`;
  }
  return `You are the support assistant for SportaBiedrs.lv, a Latvian platform to find sports partners, book venues and buy sports equipment. Help with questions about finding a partner, the map/venues, bookings, the shop, cart, delivery (Omniva pakomāts, kurjers) and sign-in (Clerk). Use only the supplied platform data for venue names, product names and prices. If asked something unrelated to the site, briefly redirect to what you can help with. Never invent prices or venues. ${base}`;
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const limited = rateLimit(req);
  if (limited) return limited;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json(503, { error: 'AI atbildes vēl nav konfigurētas.' });

  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Invalid JSON' }); }

  const mode = body.mode === 'partner' ? 'partner' : 'support';
  const lang = ['lv', 'en', 'ru'].includes(body.lang) ? body.lang : 'lv';
  const message = String(body.message || '').slice(0, 600).trim();
  if (!message) return json(400, { error: 'Empty message' });

  const persona = mode === 'partner' && body.persona && typeof body.persona === 'object'
    ? {
        name: String(body.persona.name || '').slice(0, 60),
        sport: String(body.persona.sport || '').slice(0, 60),
        city: String(body.persona.city || '').slice(0, 60),
        level: String(body.persona.level || '').slice(0, 60),
        context: String(body.persona.context || '').slice(0, 500),
      }
    : null;

  const platformData = body.platformData && typeof body.platformData === 'object'
    ? {
        venues: Array.isArray(body.platformData.venues) ? body.platformData.venues.slice(0, 80) : [],
        products: Array.isArray(body.platformData.products) ? body.platformData.products.slice(0, 80) : [],
      }
    : { venues: [], products: [] };
  const dataContext = `Platform data JSON, use it as the only source of venue and product facts: ${JSON.stringify(platformData).slice(0, 12000)}`;

  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
  const messages = [
    { role: 'system', content: `${buildSystemPrompt(mode, lang, persona)} ${dataContext}` },
    ...history
      .filter(m => m && typeof m.text === 'string')
      .map(m => ({ role: m.from === 'me' || m.role === 'user' ? 'user' : 'assistant', content: String(m.text).slice(0, 600) })),
    { role: 'user', content: message },
  ];

  let upstream;
  try {
    upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 180, temperature: 0.7 }),
    });
  } catch {
    return json(502, { error: 'Neizdevās sazināties ar AI pakalpojumu.' });
  }

  if (!upstream.ok) {
    return json(502, { error: 'AI pakalpojums šobrīd nav pieejams.' });
  }

  const data = await upstream.json();
  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) return json(502, { error: 'Tukša atbilde no AI pakalpojuma.' });

  return json(200, { reply });
};
