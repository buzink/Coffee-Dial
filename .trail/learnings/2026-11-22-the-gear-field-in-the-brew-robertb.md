---
title: "The gear field in the brew forms has no search box: a click opens or closes the full list"
author: RobertB
date: 2026-11-22
branch: main
cost: { minutes: 2, tokens: 82268 }
id: l-caa3e67d
scope: repo
status: active
src: agent
touches:
  - src/features/brews/brews-form.js
  - src/features/brews/brews-card-actions.js
---

## Decided
The user removed the search from the gear drop-down in Quick Edit Brew and in the Edit/Add Brew form. The field shows the chosen gear as pills (× removes one) and "Select gear..." when none is chosen; a click on the field toggles the list of all gear, a click outside closes it.

## Watch out
The two forms have their own copy of this code; change both. The gear filter on the Gear page (bulk edit) still has its own search and was left alone.

In the code: src/features/brews/brews-form.js (bindBrewGearUi, #brewGearPlaceholder) and src/features/brews/brews-card-actions.js (bindQuickEditGearUi, #quickEditGearPlaceholder); markup in brews-form.view.html and brews-card.view.html.
