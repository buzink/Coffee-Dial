---
title: Cards and dialogs are glass sheets with a back button top left that returns to where the card was opened from
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 10, tokens: 187267 }
id: l-603116c0
scope: repo
status: active
src: agent
touches:
  - src/features/graph-modals/graph-modals.view.html
  - src/styles/app.css
  - src/app/card-routing.js
  - tests/playwright/card-page-navigation.spec.js
---

## Decided
- Every card and dialog is an iOS-style liquid-glass sheet: full screen on mobile (below 640px), 42rem wide (the help card's width) and up to 90vh high on desktop. Wide forms (brew form, lab results) keep their own width via app-sheet-wide.
- The head has an icon row on top: back button (left), the card's type (Brew, Bag, Coffee, Gear), action icons in a glass capsule (right). Title and subtitle sit below it. The X close button is gone; the back button replaces it.
- On item cards the back button goes back in history when opening the card made a history step (a card of another type, opened from a card on another page), so a coffee card opened from a brew card returns to that brew card. Otherwise it closes the card. On dialogs it calls the dialog's close action.

## Watch out
- backdrop-filter makes a new stacking context, so the glass action capsule trapped its dropdown menu under the card's content. The head is position relative with z-index 10 to keep the menus on top.
- The panels' Tailwind classes (max-w-sm, bg-white, rounded-xl) are still in the markup; app.css overrides them with !important.

In the code: .app-sheet* rules in src/styles/app.css; markup in the *-card.view.html files and the dialog views; goBack and the [data-card-back] click listener plus appCard.pushed in src/app/card-routing.js; tests/playwright/card-page-navigation.spec.js.
