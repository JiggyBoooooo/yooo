# SportaBiedrs frontend architecture refinement — 2026-09-15

Implemented a component-level structural refinement without changing backend data strings, Clerk integration, filter parameters, checkout logic, or map data.

## Navigation / hero
- Removed visible flag/border treatment from LV / EN / RU controls; they now render as a quiet text switcher.
- Added a small active-language chevron treatment.
- Tightened navbar spacing and link alignment.
- Refined `Reģistrēties` to a 6px micro-radius CTA with balanced padding.
- Set hero statistics divider to explicit `rgba(255,255,255,.15)`.

## Directory
- Filter controls share a controlled 46px desktop height and 48px mobile height.
- `Meklēt` is bottom-aligned and matches the select controls.
- Experience badges are compact 0.75rem micro-badges with soft tones.
- `Rakstīt →` is now a structured arrow action button with hover/focus treatment.
- Demo disclaimer is separated from the card grid by a divider.

## Store
- Product images now sit inside a strict 4:3 aspect-ratio frame with centered content and an internal padding barrier.
- Product cards stretch consistently across each grid row.
- Product body receives an explicit bottom padding buffer.
- Product actions use controlled 44px targets and a consistent 7px radius.

## Messaging
- Conversation header, message body, quick actions, and composer share one controlled spacing system.
- Quick actions now sit in a dedicated row directly above the composer.
- Desktop quick actions form an aligned four-column row; mobile becomes a horizontal touch-friendly scroller.
- Mobile contacts become a horizontal selectable strip instead of an unstable multi-column layout.
- Desktop and mobile composer controls use matching heights and geometry.

## Responsive architecture
- Under 768px: filter rows, partner grids, shop grids, about grids and the chat shell collapse to one column.
- Mobile touch targets are defensively raised to at least 44px for primary interactive controls.
- Mobile navbar spacing is constrained to prevent clipping/overflow.

## Validation
- `node --check app.js`
- `node --check netlify/functions/create-checkout-session.mjs`
- `node --check netlify/functions/omniva-locations.mjs`
