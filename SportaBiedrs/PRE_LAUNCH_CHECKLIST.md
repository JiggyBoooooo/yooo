# SportaBiedrs.lv pre-launch checklist

## HTTPS and Clerk
1. Do not double-click `index.html`.
2. Local development: run `npx netlify dev` and open the HTTP localhost URL Netlify prints.
3. Production: open the deployed `https://` Netlify URL or your final `https://sportabiedrs.lv` domain.
4. In Clerk Dashboard, add the exact production HTTPS origin and the local origin used by `netlify dev` to the allowed origins/redirect settings.
5. Enable Google only after the exact production origin is configured. Keep the OAuth popup/hash-routing configuration in the frontend.
6. If Clerk CAPTCHA does not load, test in a clean browser profile, temporarily disable privacy/ad-block extensions for Clerk resources, and confirm the site is HTTPS or localhost. Do not bypass CAPTCHA in code.

## Netlify
1. Deploy the contents of this folder as the production site.
2. Confirm the production URL opens with HTTPS.
3. Enable Force HTTPS in Netlify domain management for the final custom domain. Netlify provides managed HTTPS certificates for Netlify sites and custom domains once DNS is correctly configured.
4. The build includes a narrow CSS failsafe that hides Netlify edge-injected badge/toolbar elements without hiding all iframes. Keep it in place on the Free plan; do not replace it with a blanket `iframe { display:none }` rule.
4. Keep the HSTS header only after the production domain is fully reachable through HTTPS.

## Stripe
Set these Netlify production environment variables on the deployed site:
- `STRIPE_SECRET_KEY` = Stripe test/live secret for the environment you actually intend to use.
- `STRIPE_PUBLISHABLE_KEY` = public key only if the frontend needs it.

The current checkout function uses Netlify's current `Netlify.env.get()` API and validates the product catalogue, quantity and delivery method server-side.

Do not use a live Stripe secret until the seller identity, delivery process, refund/withdrawal flow and order fulfillment process are ready.

## Seller/business details
The repository intentionally does **not** invent a legal entity. Before real sales, insert the real:
- legal name
- registration number
- registered/legal address
- email
- phone
- VAT details if applicable
- payment and refund contact
- privacy/data-controller contact

## Media/copyright
The local basketball hero image is treated as project-provided media. Product and venue images loaded from third-party URLs are listed as source references but their commercial image licence has **not** been independently established. Obtain permission/licences or replace those images before commercial launch. A source URL is not itself a copyright licence.

## Reviews
Unsourced venue ratings/review counts are hidden by the current compliance build. Only entries with an explicit `reviewSource` field may display numeric reviews in a future build.

## Tracking/cookies
No optional analytics or advertising tracker is active in this build. Necessary local browser storage is used for cart, language, demo messaging and preferences. If analytics or marketing is added later, update the cookie policy and consent mechanism before loading those scripts.

## Accessibility
The build includes:
- keyboard-visible focus states
- descriptive labels for icon buttons
- dialog semantics
- skip link
- image alt text on content images
- decorative hero image excluded from the screen-reader reading order
- reduced-motion support
- stronger text contrast for small text

A final public launch should still be checked with a real screen reader and an automated WCAG scanner in the deployed environment.
