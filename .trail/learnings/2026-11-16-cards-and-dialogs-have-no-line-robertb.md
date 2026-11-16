---
title: Cards and dialogs have no line under their headings
author: RobertB
date: 2026-11-16
branch: main
cost: { minutes: 1, tokens: 1339 }
id: l-cceec199
scope: repo
status: active
src: agent
touches:
  - src/styles/app.css
  - src/features/stats/stats.view.html
  - src/features/social/social.view.html
  - src/features/brews/brews-form.view.html
  - src/features/pin/brew-pin-art.view.html
  - src/features/gallery/gallery.js
---

## Decided
The user wanted no lines under the headings of any card or modal, because the lines made the sheets look busy next to the calm brew graph modal and Add brew form. That covers the sheet's title row and section headings inside cards and dialogs (Statistics cards, Social sections, ratio calculator, pinned-brew chooser, emoji picker).
Kept on purpose, because they are not lines under a heading: the line in the confirm dialog (it separates the message from the buttons), lines in tables and filter dropdowns (not cards or modals), and the divider under the emoji search field.

## Watch out
- The sheet heads still carry Tailwind border-b classes in their markup; app.css overrides them with border-bottom: 0 !important on .app-sheet-head. Removing that rule brings the lines back, because the markup classes still draw them.
- New cards or dialogs should not add border-b under a heading, otherwise they break the look the user asked for.

In the code: .app-sheet-head in src/styles/app.css; h4 headings in src/features/stats/stats.view.html; accordion headers in src/features/social/social.view.html; ratioCalcModal and formContainerHeader in src/features/brews/brews-form.view.html; src/features/pin/brew-pin-art.view.html; reaction picker header in src/features/gallery/gallery.js.
