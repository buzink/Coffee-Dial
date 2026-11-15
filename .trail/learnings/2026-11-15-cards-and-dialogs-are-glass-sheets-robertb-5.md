---
title: Cards and dialogs are glass sheets with a centred title; item cards keep their close X in the same capsule as their other icons
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 9, tokens: 32756 }
id: l-ae339b9c
scope: repo
status: active
replaces: l-459e54c8
src: agent
touches:
  - src/styles/app.css
  - src/app/card-routing.js
  - tests/playwright/card-page-navigation.spec.js
---

## Decided
- Every card and dialog is an iOS-style liquid-glass sheet: full screen on mobile (below 640px), 42rem wide (the help card's width) and up to 90vh high on desktop. Wide forms (brew form, lab results) keep their own width via app-sheet-wide.
- The head starts with one row: back button (left), the title (.app-sheet-type) and the icons in a glass capsule (right). Dialogs centre their own title in the whole header; item cards centre their type (Brew, Bag, Coffee, Gear) between the back button and the capsule, with the item's name large below the row.
- On brew, bag, coffee and gear cards the capsule ends with the close X (the user wanted quick edit, menu and X as one group, not the X apart). The X closes the card and stays on the overview page under it. Dialogs such as Help have no page under them, so they have only the back button.
- Back on an item card goes back in history when opening the card made a history step (a card of another type, opened from a card on another page), so a coffee card opened from a brew card returns to that brew card. Otherwise it closes the card.

## Watch out
- backdrop-filter makes a new stacking context, so the glass action capsule trapped its dropdown menu under the card's content. The head is position relative with z-index 10 to keep the menus on top.
- A dialog body with its own height cap (max-h-[60vh] on Preferences) left an empty block under the content of the full-screen sheet; app.css lets such bodies fill the sheet and scroll.
- The panels' Tailwind classes are still in the markup; app.css overrides them with !important or more specific rules.

In the code: .app-sheet* rules in src/styles/app.css; markup in the *-card.view.html files and the dialog views; goBack and the [data-card-back]/[data-card-close] click listener plus appCard.pushed in src/app/card-routing.js; tests/playwright/card-page-navigation.spec.js.
