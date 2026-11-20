---
title: "Brew temperature is only a number in °C, set with minus/plus buttons behind the field"
author: RobertB
date: 2026-11-20
branch: main
cost: { minutes: 24, tokens: 49267 }
id: l-c8632d25
scope: repo
status: active
src: agent
touches:
  - src/app/composition/action-assemblies.js
  - src/app/composition/app-composition.js
  - src/app/pwa.js
  - src/features/brews/brew-form-ui.js
  - src/features/brews/brews-actions.js
  - src/features/brews/brews-form.js
  - src/features/brews/brews-form.view.html
  - src/features/devices/devices-modals.js
  - src/features/graph-modals/graph-modals.view.html
  - src/features/media/media-modals.js
---

## Decided
The user dropped the °C/profile switch on the brew form's Temp field: temperature is a number in °C only. The native number arrows are hidden because they do not work on mobile; minus/plus buttons behind the field step 1 °C, and an empty field starts at 93 (the placeholder). An empty temperature is now saved empty, no longer as "M" (the old profile default).

## Watch out
Older brews can still hold a profile value (L4…H4). Repeat leaves the Temp field empty for them; the brew card and its quick edit (a text field) still show and edit them.

In the code: stepTemp in src/features/brews/brew-form-ui.js (action stepTemp); #tempNumeric with .temp-input and .temp-step-btn in src/features/brews/brews-form.view.html and src/styles/app.css; finalTemp in handleFormSubmit in src/features/brews/brews-actions.js.
