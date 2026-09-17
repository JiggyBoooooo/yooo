# SportaBiedrs.lv - final setup

## Deploy
- Netlify publish directory: `.`
- Netlify Functions directory: `netlify/functions`
- Use HTTPS in production.
- For local testing, use `netlify dev` instead of opening `index.html` with `file://`.

## Clerk authentication
The frontend uses ClerkJS and opens Clerk's hosted Sign In / Sign Up UI. The redirect URL is derived only from an HTTP/HTTPS origin, so `file://` is never sent to Clerk.

In Clerk Dashboard:
1. Add the production origin, for example `https://sportabiedrs.lv`.
2. Add your local origin used by `netlify dev` (normally `http://localhost:8888` or the port Netlify reports).
3. Enable the Google social connection if Google sign-in is required.
4. For development, keep Clerk bot protection enabled unless it blocks your test browser. If CAPTCHA says it cannot load, test in a clean browser profile, allow required third-party resources/cookies, disable privacy/ad-block extensions for the Clerk domain, and make sure the site is HTTPS/localhost. CAPTCHA must not be bypassed in application code.

## Stripe
Set these in Netlify Environment Variables, never in frontend JavaScript:
- `STRIPE_SECRET_KEY`

The published frontend does not contain a Stripe secret.

The Netlify function validates product IDs, quantities and delivery method server-side. It supports:
- Omniva parcel machine: 2.99 EUR
- Courier: 4.99 EUR
- Cash on delivery: only for courier
- Stripe online payment: forwarded to Stripe Checkout

There is no store pickup because SportaBiedrs does not have a physical store location.

Stripe payment receipts/emails are controlled by your Stripe account settings. A custom transactional email service is not included until an email provider and domain are configured.

## Venue booking
The booking UI is an interactive demo flow with local slot persistence. Real live availability requires each venue's own booking system/API integration. Google Maps links provide current public venue photos/reviews when available.

## Legal pages
The footer includes working in-site pages for purchase terms, delivery/returns, privacy and cookies. Replace the placeholder company details with the real SIA identity, registration number, legal address and contact details before production.


## Local auth testing
Clerk cannot use `file://` URLs. Run `netlify dev` and open the HTTP localhost URL, or use the deployed HTTPS site. The frontend avoids sending file URLs to Clerk.

## Omniva locations
Checkout refreshes the LV locker list from `netlify/functions/omniva-locations.js`, backed by Omniva's public location feed with a 12-hour cache and bundled fallback.


## Final pre-publish checks

### Clerk
Use the deployed HTTPS domain or `netlify dev`; do not open `index.html` directly with `file://`. The frontend mounts Clerk SignIn/SignUp with hash routing and OAuth popup mode. Clerk's Dashboard should have Google enabled and the deployed domain added to the instance's allowed origins/redirect configuration. The Clerk docs recommend popup OAuth when the domain needs it and hash routing for SPA-style SDKs.

### Stripe
`STRIPE_SECRET_KEY` belongs only in Netlify environment variables. Checkout validates product IDs, quantities and delivery server-side. Online payments use Stripe automatic payment methods; cash is handled as a courier-only demo order.

### Omniva
The checkout first tries the Netlify Omniva locations function and uses a cached/fallback location set if the live feed is unavailable. This is still a prototype; before launch, confirm the current Omniva feed/licensing and operational agreement.

### Legal
The built-in legal pages are a structured prototype, not final legal advice. Before public launch, insert the real seller/controller details and finalize the purchase terms, privacy notice, cookie details and withdrawal form against the actual business model. PTAC currently describes the 14-day withdrawal period for applicable distance purchases and related information duties.

## HTTPS / Clerk quick fix
Never open `index.html` by double-clicking it. That produces a `file://` origin, which Clerk cannot use for web authentication. Use `npx netlify dev` locally or the deployed HTTPS URL in production. The frontend now redirects normal HTTP production traffic to HTTPS before Clerk initializes.

For production Clerk, add the exact deployed HTTPS origin in the Clerk Dashboard and make sure Google OAuth is enabled for that origin. If CAPTCHA fails to load, test from a clean browser profile and disable privacy/ad-block extensions that block Clerk's CAPTCHA resources; do not bypass the challenge in code.

## Legal / privacy
The build now includes standalone `terms.html`, `delivery-returns.html`, `withdrawal.html`, `privacy.html`, `cookies.html` and `accessibility.html` pages. They contain a pre-launch warning because the real legal seller/controller details were not provided and must not be invented.

## Netlify badge failsafe

`styles.css` contains a narrowly scoped failsafe that hides Netlify edge-injected badge/toolbar elements when they expose Netlify-identifying iframe/attribute selectors. It does **not** hide all iframes, so Leaflet, Clerk, Stripe and other legitimate third-party frames are not blanket-disabled. Keep the selectors narrow; do not replace them with `iframe { display:none }`.
