---
title: Drop-downs in cards and dialogs keep the native menu but draw their own chevron
author: RobertB
date: 2026-11-16
branch: main
cost: { minutes: 24, tokens: 100457 }
id: l-1bf69b2d
scope: repo
status: active
src: agent
touches:
  - src/app/pwa.js
  - src/features/beans/beans-card.view.html
  - src/features/brews/brews-card.view.html
  - src/features/brews/brews-form-modal.view.html
  - src/features/brews/brews-form.view.html
  - src/features/coffees/coffee-type-card.view.html
  - src/features/gallery/gallery.js
  - src/features/gas/gas-card.view.html
  - src/features/pin/brew-pin-art.view.html
  - src/features/preferences/preferences.view.html
---

## Decided
Selects in cards and dialogs use appearance none with an SVG chevron 0.75rem from the right edge, because the browser's own arrow sat on the field's right border and was partly cut off.
The opened list stays the native menu. On macOS that menu is placed so the chosen option lies over the field, so it covers the chevron; the user chose to keep that rather than build a custom dropdown, because a custom one loses the phone's picker wheel and needs its own keyboard and screen reader support.

## Tried and ruled out
- Fixing the open menu's position with CSS: a page cannot position the native macOS select menu.

## Watch out
- The rule only covers selects inside .app-sheet; drop-downs on pages (e.g. "My brews") keep the browser's arrow.

In the code: ".app-sheet select:not([multiple]):not([size])" in src/styles/app.css (light chevron #7f5539, dark #a8a29e, padding-right 2.25rem).
