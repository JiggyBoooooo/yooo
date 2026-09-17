# SportaBiedrs.lv — Final UI / Map / Messages Pass

## Implemented

### Map
- Rebuilt sport marker iconography into a consistent custom line-icon family.
- Added specific icons for tennis, padel, basketball, football, hockey, volleyball, disc golf, boxing, fitness, swimming, running, cycling, badminton, table tennis, climbing, judo, pickleball, athletics, yoga, golf and extreme sports.
- Corrected the Sigulda bobsleigh/luge venue classification from cycling to extreme sports so it no longer receives a bicycle icon.
- Increased marker clarity and made marker hover titles identify the exact venue.
- Added verified additional venues/sports with addresses and coordinates: Falkors Bouldering Center, LSPA stadium, Players Club LV, FUDOSHIN Judo Club and a pickleball listing at National Tennis Centre Lielupe.
- Expanded the map sport filter to include the new sports.

### Partner finder
- Added new sports to the finder.
- Tightened card hierarchy, spacing, buttons and status badges.
- Improved section intro hierarchy and the disclaimer divider.

### Messages
- Fixed the contact list active-state bug: the selected contact now stays selected instead of visually snapping back to the first contact.
- Fixed the partner-card “Rakstīt” action to open the matching demo contact when that person exists in the demo message list.
- Improved mobile chat sizing so the input row remains inside the viewport and the conversation area can scroll safely.

### Global design system
- Reduced rounded/pill-heavy prototype styling in core navigation, buttons, filters, cards and chat controls.
- Enforced a 12px outer container radius and 6–8px interaction radius system.
- Strengthened typography hierarchy and alignment.
- Added active navigation states with a strict underline treatment.
- Improved map/browser split layout to a more intentional 60/40 desktop balance.
- Added safer mobile overflow guards and a more reliable mobile navigation panel.
- Hardened the Clerk auth modal against mobile viewport clipping.
- Improved About / value-proposition cards and footer grid consistency.

## Data note
The uploaded project archive did not contain an XLSX/CSV venue spreadsheet. Existing venue coordinates were therefore preserved from the project's embedded venue dataset, while the newly added venues use source-verified address/coordinate data.

## Validation
- `node --check app.js` passes after the changes.
- The project keeps the original Netlify/Stripe/Clerk structure intact.
