---
title: "Everything you tap in the brew form is at least 44 px high, so it is easy to use on a phone"
author: RobertB
date: 2026-11-20
branch: main
cost: { minutes: 9, tokens: 59868 }
id: l-547ad44d
scope: repo
status: active
src: agent
touches:
  - src/app/pwa.js
  - src/features/brews/brews-form.view.html
  - src/styles/app.css
  - sw.js
---

## Decided
The user wanted the Add/Edit brew form easier to use on a phone. They first saw a mock-up and then had it applied at every width:
- Fields and selects that were 38 px or 34 px are now 44 px.
- Extract, the Gear search, the Temp minus/plus buttons and the Flow readout are 44 px.
- Each rating star has a 44x44 tap area.
- The switches keep their size, but the whole Auto/Swirls/Pours row is a label 44 px high, so tapping the row text flips the switch.

## Watch out
- The settings switches on the Preferences page and the star rows outside the brew form still use the old, smaller sizes.
- The star row has a negative left margin so the first star stays in line with the fields. If the star icon size changes, check that alignment again.
- Tapping the switch inside its row label flips it only once, but a script that clicks the small switch track gets blocked, because the checkbox lies on top of it.

In the code: src/styles/app.css next to `.temp-step-btn` (min-height 2.75rem on `#brewFormModal select`, `#brewFormModal input:is(.py-2, .py-1\.5)`, `#brewGearControl` and `.graph-toggle-row`; `#aiScanBtn`, `#flow`, `#starContainer i`). The toggle rows in src/features/brews/brews-form.view.html are `<label for=…>` and contain only spans.
