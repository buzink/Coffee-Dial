---
title: "The gear field in the brew forms has no search box: a click opens or closes the full list"
author: RobertB
date: 2026-11-22
branch: main
cost: { minutes: 10, tokens: 125956 }
id: l-caa3e67d
scope: repo
status: active
src: agent
touches:
  - src/features/brews/brews-form.js
  - src/features/brews/brews-card-actions.js
  - ".github/copilot-instructions.md"
  - AGENTS.md
  - GEMINI.md
  - src/app/pwa.js
  - src/features/brews/brew-form-actions.js
  - sw.js
  - src/features/brews/brews-card.view.html
  - src/features/brews/brews-form.view.html
---

## Decided
The user removed the search from the gear drop-down in Quick Edit Brew and in the Edit/Add Brew form. The field shows the chosen gear as pills (× removes one) and "Select gear..." when none is chosen; a click on the field toggles the list of all gear, a click outside closes it.
The user wanted the gear drop-down in Quick Edit Brew and Add/Edit Brew grouped by gear type, and limited to gear that belongs to the chosen method. Gear without any methods (e.g. a grinder used for everything) always shows; gear already chosen stays visible so it can be unticked; no method or "Other" shows all gear. Changing the method does not remove gear that was already chosen.

## Watch out
The two forms have their own copy of this code; change both. The gear filter on the Gear page (bulk edit) still has its own search and was left alone.

In the code: src/features/brews/brews-form.js (bindBrewGearUi, #brewGearPlaceholder) and src/features/brews/brews-card-actions.js (bindQuickEditGearUi, #quickEditGearPlaceholder); markup in brews-form.view.html and brews-card.view.html.
Group headings use the raw gear type (Dripper, Filter, ...), while the Gear page shows types outside its short list as "Other". Both forms share one helper, so change it there, not in each form.

In the code: src/features/brews/gear-options.js (toGearOption, filterGearOptionsForMethod, buildGearDropdownHtml), used by renderBrewGearDropdown (method field #method) and renderQuickEditGearDropdown (#quickEditMethod).
