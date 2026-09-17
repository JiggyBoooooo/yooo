# SportaBiedrs — Language + Map Repair

## Fixed in this build

### Global language switching
- Language state now updates the entire main application, not only the hero and navbar.
- Announcement bar, hero statistics, Finder, Map controls, venue list, Shop, Messages, About, footer, cookie banner, cookie settings, cart drawer, booking modal, checkout UI, chatbot UI and in-page legal dialogs all update with LV / EN / RU.
- Canonical filter values are preserved while only the visible labels are translated, preventing English/Russian filters from breaking the underlying Latvian dataset matching.
- Browser `<title>`, meta description and `<html lang>` are synchronized with the selected language.
- DM canned replies are translated to the active language.

### Map marker repair
- Removed remote image dependency from sport map markers. A marker can no longer become a broken-image icon because a CDN image failed.
- Standard sports use familiar native sports emoji artwork; Padel and Pickleball use purpose-built inline vectors.
- Marker dimensions and Leaflet anchor are matched at 44×44px so the visual center sits directly on the exact venue coordinate.
- The same sport key always resolves to the same marker artwork.
- Added support for all 21 represented sport categories.

### Location/data corrections
- Replaced the old mismatched "Padel Elite Jūrmala" demo entry at Jomas iela 42 with the real Majorenhoff tennis venue at Jomas iela 42, Majori, Jūrmala and corrected its coordinates.
- Added three verified sport categories that were previously absent from the map dataset: badminton, golf and yoga.
  - Rīgas badmintona skola — Dzelzavas iela 120C, Rīga.
  - Ozo Golf Club — Mīlgrāvja iela 16, Rīga.
  - Anahata jogas skola — Tērbatas iela 49/51, Rīga.

### Other UI hardening
- Cart labels and accessibility text follow the active language.
- Open booking/legal dialogs re-render their visible labels when language is changed.
- Cookie "Learn more" now opens the localized in-page cookie policy dialog instead of taking the user to a permanently Latvian-only page.

## Validation
- `node --check app.js` passes.
- Map marker generation contains no external `<img>` dependency.
- Venue dataset remains JSON-valid and now contains 168 venue entries across 21 sport keys.
