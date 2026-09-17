# SportaBiedrs.lv compliance / pre-launch audit

## Completed in this build
- Added local favicon.
- Added automatic HTTP -> HTTPS browser redirect for non-localhost hosts.
- Added security headers (HSTS, nosniff, referrer policy, permissions policy).
- Added a narrowly scoped CSS failsafe for Netlify edge-injected badge/toolbar iframes and elements; it does not blanket-hide legitimate third-party iframes.
- Added real standalone legal pages: terms, delivery/returns, privacy, cookies, accessibility, withdrawal form.
- Added mandatory checkout checkbox for purchase terms and delivery/withdrawal information.
- Removed the “Pieņemt visas” cookie claim because no optional analytics/tracking is active in this build.
- No Google Analytics, Meta Pixel, Hotjar, Clarity or other ad/analytics tracker was found in the source.
- Added accessible labels to icon buttons, dialog semantics, focus styles and reduced-motion support.
- Ratings/review counts are hidden unless a `reviewSource` field exists. This prevents unsourced review counts being presented as facts.
- Venue/product images keep descriptive `alt` text; the decorative hero image is intentionally `alt=""`.

## Still required before real commercial launch
1. Insert the real legal seller/controller details: legal name, registration number, legal address, contact email/phone, VAT status if applicable.
2. Confirm the legal basis and retention periods for each personal-data flow with a Latvian privacy professional.
3. Obtain and document commercial image rights/licenses for every third-party product/venue image. A source URL is not itself a copyright licence.
4. Replace demo review data with verified data sourced under terms that permit reuse, or keep reviews hidden.
5. Configure actual email delivery for order confirmations and withdrawal requests.
6. Configure Clerk’s production domain, OAuth providers, CAPTCHA/bot-protection and authorized origins after HTTPS deployment.
7. Keep Stripe test mode until the company, bank/Stripe account, terms, refunds and fulfillment process are ready.
8. Before production, test the entire site with keyboard-only navigation and a real screen reader, and run an automated WCAG scanner.

## Current tracking status
No optional tracking code is active. The site uses localStorage for necessary UX state and demo data.

## Important legal note
This is a technical pre-launch audit, not legal advice. Latvian consumer and GDPR obligations depend on the actual company, business model, payment flow and data-processing arrangements.
