# Final revision

- Restored the original SportaBiedrs basketball hero image from the supplied asset.
- Kept the exact slogan: `Vienatnē trenēties ir grūtāk. Kopā ir vieglāk.` with the second sentence italicized.
- Removed hero navigation chips and cleaned the visual hierarchy.
- Rebuilt LV / EN / RU language flags as inline SVGs, including a proper blue-background Union Jack.
- Map now defaults to Riga, uses marker clustering, has larger map space, 56 venue entries, stronger sport icons, filters above the map, venue pagination, photos/covers and booking actions.
- Venue cards no longer claim unverified data as "Pārbaudīts". They show city, rating/review count where available, pricing and public Google Maps sources.
- Added a richer venue booking demo with date/time/players and local slot persistence.
- Reworked messages UI into a modern conversation layout with contact previews, quick actions and seeded demo context.
- Chatbot now searches the actual product catalogue and venue data before generating a response. Product questions such as "cik maksā casall yoga mat" resolve to the actual catalogue item.
- Product cards use exact product image URLs with an image proxy and a neutral fallback instead of unrelated sport illustrations.
- Corrected the previously mismatched hockey products and product image links for Trek, Adidas, Babolat, CCM, Bauer, Everlast and Discraft.
- Checkout removes physical store pickup, switches Omniva city -> locker dynamically, switches courier -> address dynamically, and allows cash only for courier.
- Stripe Checkout is server-side with product/quantity validation.
- Clerk uses hosted authentication with HTTPS-safe fallback redirects instead of `file://` redirects.
- Footer legal links now open real in-site content instead of dead `#about` placeholders.
- Removed em-dashes from generated project text.


## 2026-09-15: Venue expansion and map audit
- Expanded the venue dataset with verified disc-golf courses across Latvia, additional football venues in Riga, and additional fitness centres.
- Replaced the disc-golf cover with a Latvia disc-golf photograph.
- Expanded city filters to include the new course locations.
- Improved disc-golf marker geometry.
- Added requestAnimationFrame batching to slider/filter redraws to reduce map jitter and unnecessary repeated rendering.

## 2026-09-15: Venue expansion and code hardening (deep audit)

- Expanded the venue database to 97 locations.
- Expanded disc golf coverage to 21 locations, including Laumu Dabas Parks, Lūša Ķepa and Rezidence Kurzeme.
- Expanded football coverage to 12 locations, including LNK Sporta Parks, Rīgas Hanzas vidusskolas football stadium, Liepājas Daugava/Reserve stadiums and the 2026 Daugavpils inflatable football hall.
- Expanded fitness coverage to 22 locations, including multiple FitSpot branches and LEMON GYM Ziepniekkalns.
- Replaced the questionable Riekstukalns image URL (a webpage URL) with a real disc-golf image fallback.
- Disc golf now uses Latvia-specific photography as its default sport cover and a cleaner basket/disc marker icon.
- Venue image failures now fall back to the correct sport cover instead of always falling back to the basketball hero image.
- Non-bookable venue popups no longer show a misleading "Rezervēt" button; they show an information action instead.
- Booking images now also have a sport-aware fallback.
- Added Jēkabpils to the map and partner-city filters.
- Preserved verified ratings only where they were supported by the current source; newly researched venues without review evidence do not display invented ratings.
- Re-ran frontend and Stripe Netlify Function syntax checks after the expansion.


### Pre-publish fixes
- Normalized all Padel labels.
- Replaced questionable padel entries with current verifiable MH Padel Club and VARPU Tennis & Padel Club records.
- Corrected RTU Ķīpsalas peldbaseins, Aqua Dream and SwimBaltic coordinates.
- Removed the image proxy causing failed venue/product images.
- Improved sport marker SVGs.
- Reset demo DM history key to v6 and added reset control.
- Simplified Clerk redirect setup for HTTPS/localhost.
- Added dynamic Omniva LV parcel-machine feed with cache and fallback.
- Improved Stripe Checkout payment handling and courier-only shipping address collection.


## Deep pre-publish QA — 15 Sep 2026
- Corrected Jāņa Daliņa stadions to the authoritative Valmiera location (Jāņa Daliņa iela 2; 57.541010, 25.440471).
- Corrected/added venue imagery sources where official gallery URLs are available.
- Kept venue photo fallbacks sport-specific so broken remote assets never render as broken-image boxes.
- Removed custom Clerk sign-in/sign-up path strings that could participate in prohibited URL-scheme redirects; Clerk now mounts with SPA hash routing and OAuth popup mode only.
- Refined checkout hierarchy and microcopy; retained Omniva/courier switching and removed physical-store pickup.
- Reset demo DM storage key so stale test prompts do not persist between builds.

## 2026-09-15 — Latvia main-city map expansion
- Expanded the map from 97 to 114 venues.
- Added 17 current facilities across Jelgava, Jūrmala, Daugavpils, Liepāja, Ventspils, Valmiera, Rēzekne, Jēkabpils and Ogre.
- Ensured each of these main-city areas now has at least 4 mapped venues, with sport variety where the official sources support it.
- New records use neutral pricing (`Pēc pieprasījuma`) where a current public rental tariff was not verified, rather than inventing prices.
- New records do not contain fabricated ratings/review counts (`rating:null`, `reviews:0`).
- Main authoritative cross-check source: Latvian Ministry of Education and Science sports-facility register (edition 21.05.2026), supplemented with current official municipal/sports-organisation pages.
