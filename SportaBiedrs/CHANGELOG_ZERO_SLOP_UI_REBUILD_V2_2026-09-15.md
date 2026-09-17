# SportaBiedrs — Zero-Slop UI Rebuild v2 — 2026-09-15

## Map sport icons
- Replaced the previous generic monochrome line-art markers with recognizable sport-specific artwork.
- Each `sportKey` maps to exactly one visual across the whole map, so the same sport always has the same symbol.
- Unicode sports use Twemoji SVG artwork served from jsDelivr.
- Padel uses a dedicated racket vector from SVG Repo (CC0 asset 156759).
- Pickleball uses a purpose-built paddle + perforated-ball vector because there is no dedicated Unicode pickleball emoji.
- The marker wrapper remains consistent (44px desktop) so the icon art, not the background color, is what differentiates sports.

## Directory / Atrast biedru
- Filter CTA is locked to the same control height as the select fields.
- Partner experience badges are compact inline micro-badges.
- `Rakstīt` is a real structured action button.
- Partner → Ziņas now creates a demo conversation automatically when a generated partner is not already in the fixed demo contact list.

## Ziņas / DMs
- Fixed the active-thread reset problem: `initDM()` no longer blindly opens contact 0 after every message/render.
- The selected contact remains selected when the message history updates.
- Dynamic partner conversations survive for the current session and use the selected sport/city/level.
- Desktop quick actions are a single aligned action rail above the composer.
- Mobile turns the contact list into a horizontal contact strip and preserves 44px touch targets.

## Veikals
- Product cards now use a true square media well with a consistent visual frame.
- Product image padding is controlled independently from the card's content padding.
- Product titles/descriptions/pricing follow a stable vertical rhythm.
- Cards equalize to the same grid row height and get a controlled hover elevation.
- Bottom CTA spacing is protected so buttons do not touch the lower border.
- Shop filters use a restrained two-column toolbar on desktop and collapse to one column on mobile.

## References
- Twemoji: https://github.com/jdecked/twemoji
- SVG Repo racket asset: https://www.svgrepo.com/svg/156759/racket
