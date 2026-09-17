# SportaBiedrs — Zero-Slop UI Rebuild — 2026-09-15

## Global
- Replaced the navbar multi-flag control with a compact LV/EN/RU text dropdown.
- Enforced editorial serif headings and geometric sans-serif UI/body typography.
- Tightened container/grid constraints and removed remaining oversized pill treatment from primary UI.
- Preserved existing data, Clerk logic, dynamic filters, map filtering, cart and checkout behavior.

## Map icon engine
- Unified all sport markers to a 40px circular high-contrast marker with a centered 18px custom SVG vector.
- Retained dedicated sport-specific vector glyphs for tennis, padel, football, basketball, hockey, disc golf, fitness, swimming, golf, volleyball, boxing/MMA, cycling, judo, athletics, table tennis, yoga, extreme sports, climbing, pickleball, running and badminton.
- Cluster markers use the same visual language instead of template map-pin styling.

## Directory
- Search CTA now uses the same 48px control height and 7px radius as the adjacent selects.
- Experience levels are compact inline micro-badges with tier-specific pastel tones.
- Partner action became a structured 40x40 arrow button with hover/focus treatment.

## Store
- Product image frames are square, centered and uniformly padded.
- Fallback artwork sits inside the same image frame.
- Product cards use equal-height flex structure and guaranteed bottom action breathing room.
- Product CTAs use consistent touch-safe heights.

## Messaging
- Sidebar and conversation are locked into one coherent container.
- Conversation header aligns to the message body content area.
- Quick replies use a dedicated horizontal action rail directly above the composer.
- Composer controls share matching geometry and 48px height.

## Mobile
- Filters, partner cards, store cards and content grids collapse to one column below 768px.
- Navigation, buttons, filters, quick actions and interactive cards receive a minimum 44px touch target on mobile.
- Chat quick actions remain horizontally scrollable without breaking the message composer.
