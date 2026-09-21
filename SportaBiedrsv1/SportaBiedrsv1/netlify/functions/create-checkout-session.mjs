import Stripe from 'stripe';

const PRODUCTS = {
  'wilson-pro-staff-97-v14': { name:'Wilson Pro Staff 97 v14 tenisa rakete', amount:27200, description:'Profesionāla līmeņa rakete, 97 kv. collas, 315 g.' },
  'head-radical-mp': { name:'Head Radical MP tenisa rakete', amount:21900, description:'Universāla tenisa rakete vidēja līmeņa spēlētājiem.' },
  'adidas-adipower-padel-33': { name:'Adidas Adipower Multiweight 3.3 padel rakete', amount:22000, description:'Adidas Adipower Multiweight 3.3 padel rakete.' },
  'babolat-technical-viper': { name:'Babolat Technical Viper padel rakete', amount:29600, description:'Babolat Technical Viper 2025 padel rakete.' },
  'wilson-evolution-basketball': { name:'Wilson Evolution basketbola bumba', amount:5490, description:'Wilson Evolution basketbola bumba.' },
  'spalding-tf1000-basketball': { name:'Spalding TF-1000 basketbola bumba', amount:4990, description:'Spalding TF-1000 basketbola bumba.' },
  'nike-strike-football': { name:'Nike Strike futbola bumba', amount:3490, description:'Nike Strike treniņu futbola bumba.' },
  'bauer-supreme-m5-pro-skates': { name:'Bauer Supreme M5 Pro slidas', amount:47900, description:'Bauer Supreme M5 Pro hokeja slidas.' },
  'ccm-tacks-as580-skates': { name:'CCM Tacks AS580 hokeja slidas', amount:35999, description:'CCM Tacks AS580 pieaugušo hokeja slidas.' },
  'mikasa-v200w-volleyball': { name:'Mikasa V200W volejbola bumba', amount:6490, description:'Mikasa V200W volejbola bumba.' },
  'venum-challenger-30-gloves': { name:'Venum Challenger 3.0 boksa cimdi', amount:5490, description:'Venum Challenger 3.0 boksa cimdi.' },
  'everlast-pro-style-bag': { name:'Everlast Nevatear Heavy boksa maiss', amount:8900, description:'Everlast piekaramais boksa maiss.' },
  'speedo-fastskin-goggles': { name:'Speedo Fastskin peldbrilles', amount:3490, description:'Speedo Fastskin peldbrilles.' },
  'arena-powerskin-swimsuit': { name:'Arena Powerskin peldkostīms', amount:7490, description:'Arena Powerskin peldkostīms.' },
  'nike-pegasus-41-shoes': { name:'Nike Pegasus 41 skriešanas apavi', amount:14999, description:'Nike Pegasus 41 skriešanas apavi.' },
  'garmin-forerunner-265-watch': { name:'Garmin Forerunner 265 viedpulkstenis', amount:39900, description:'Garmin Forerunner 265 GPS skriešanas pulkstenis.' },
  'trek-marlin-7': { name:'Trek Marlin 7 Gen 3 kalnu velosipēds', amount:89900, description:'Trek Marlin 7 Gen 3 kalnu velosipēds.' },
  'giro-syntax-helmet': { name:'Giro Syntax velo ķivere', amount:11900, description:'Giro Syntax velo ķivere.' },
  'casall-yoga-mat-balance': { name:'Casall Yoga Mat Essential Balance 4mm', amount:3800, description:'Casall Yoga Mat Essential Balance 4mm.' },
  'innova-star-destroyer': { name:'Innova Star Destroyer disku golfa disks', amount:1990, description:'Innova Star Destroyer disku golfa disks.' },
  'discraft-buzzz': { name:'Discraft Buzzz midrange disks', amount:1850, description:'Discraft Buzzz midrange disku golfa disks.' }
};

const SHIPPING = { omniva: 299, courier: 499 };
const json = (status, body, extraHeaders = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders }
});

const rateBuckets = globalThis.__sbCheckoutRateBuckets ??= new Map();
const getClientKey = (req) => (req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim().slice(0,120);
const rateLimit = (req, limit=30, windowMs=60_000) => {
  const now = Date.now();
  const key = getClientKey(req);
  const hit = rateBuckets.get(key);
  if (!hit || now - hit.started >= windowMs) { rateBuckets.set(key, { started: now, count: 1 }); return null; }
  hit.count += 1;
  if (hit.count <= limit) return null;
  const retryAfter = Math.max(1, Math.ceil((hit.started + windowMs - now) / 1000));
  return json(429, { error: 'Too many checkout attempts. Please wait a moment and try again.', code: 'RATE_LIMITED' }, { 'Retry-After': String(retryAfter) });
};
const cleanText = (value, max=500) => String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0,max);
const sameOrigin = (req) => {
  const origin = req.headers.get('origin');
  return !origin || origin === new URL(req.url).origin;
};

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Only POST is allowed.' }, { Allow: 'POST' });
  if (!sameOrigin(req)) return json(403, { error: 'Cross-origin request blocked.', code: 'ORIGIN_BLOCKED' });
  const limited = rateLimit(req); if (limited) return limited;

  const secret = Netlify.env.get('STRIPE_SECRET_KEY');
  if (!secret) return json(500, { error: 'Stripe nav konfigurēts: trūkst STRIPE_SECRET_KEY.', code: 'STRIPE_CONFIG_MISSING' });

  const stripe = new Stripe(secret);
  try {
    const body = await req.json();
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!items.length) return json(400, { error: 'Grozs ir tukšs.' });
    if (items.length > 30) return json(400, { error: 'Grozā ir pārāk daudz unikālu preču.', code: 'TOO_MANY_ITEMS' });

    const delivery = body?.delivery?.method || 'omniva';
    const payment = body?.delivery?.payment || 'stripe';
    const destination = cleanText(body?.delivery?.destination, 500);

    if (!['omniva', 'courier'].includes(delivery)) return json(400, { error: 'Nepareizs piegādes veids.' });
    if (payment !== 'stripe') return json(400, { error: 'Šim pieprasījumam Stripe nav izvēlēts.' });
    if (!destination) return json(400, { error: 'Piegādes vieta nav norādīta.' });
    if (delivery === 'omniva' && destination.length > 240) return json(400, { error: 'Pakomāta izvēle nav derīga.' });
    if (delivery === 'courier' && destination.length > 500) return json(400, { error: 'Piegādes adrese ir pārāk gara.' });

    const lineItems = [];
    for (const item of items) {
      const product = PRODUCTS[item?.id];
      const quantity = Number(item?.quantity);
      if (!product) return json(400, { error: `Prece nav atrasta: ${String(item?.id || '')}` });
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) return json(400, { error: 'Nepareizs preces daudzums.' });
      lineItems.push({
        quantity,
        price_data: {
          currency: 'eur',
          unit_amount: product.amount,
          product_data: { name: product.name, description: product.description }
        }
      });
    }

    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: SHIPPING[delivery],
        product_data: { name: delivery === 'omniva' ? 'Omniva pakomāta piegāde' : 'Kurjera piegāde' }
      }
    });

    const origin = new URL(req.url).origin;
    const customerEmail = typeof body?.customer?.email === 'string' ? cleanText(body.customer.email, 320) : undefined;
    const customerName = typeof body?.customer?.name === 'string' ? cleanText(body.customer.name, 200) : '';
    if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) return json(400, { error: 'E-pasta adrese nav derīga.', code: 'INVALID_EMAIL' });
    if (customerName && customerName.length < 2) return json(400, { error: 'Vārds nav derīgs.', code: 'INVALID_NAME' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'lv',
      line_items: lineItems,
      customer_email: customerEmail || undefined,
      billing_address_collection: 'required',
      ...(delivery === 'courier' ? { shipping_address_collection: { allowed_countries: ['LV'] } } : {}),
            customer_creation: 'always',
      phone_number_collection: { enabled: true },
      origin_context: 'web',
      metadata: {
        delivery_method: delivery,
        destination: destination.slice(0, 500),
        customer_name: customerName
      },
      custom_text: {
        submit: { message: 'Pēc apmaksas saņemsi pasūtījuma apstiprinājumu.' }
      },
      success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?payment=cancelled`
    });

    return json(200, { url: session.url });
  } catch (error) {
    const type = error?.type || 'unknown';
    const code = error?.code || error?.raw?.code || 'STRIPE_CHECKOUT_ERROR';
    const status = Number(error?.statusCode || error?.status || 500);
    console.error('Stripe Checkout error', { type, code, status, message: error?.message });
    const safeMessage = type === 'StripeAuthenticationError' ? 'Stripe autentifikācija neizdevās. Pārbaudi Netlify STRIPE_SECRET_KEY.' : type === 'StripePermissionError' ? 'Stripe kontam nav tiesību izveidot Checkout sesiju.' : 'Stripe Checkout sesiju neizdevās izveidot. Pārbaudi Stripe iestatījumus un mēģini vēlreiz.';
    return json(status >= 400 && status < 600 ? status : 500, { error: safeMessage, code });
  }
};
