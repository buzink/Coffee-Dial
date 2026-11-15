---
title: "Cards and dialogs are glass sheets with the back button and title in one row; only brew, bag, coffee and gear cards also get a close X"
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 2, tokens: 22522 }
id: l-459e54c8
scope: repo
status: active
replaces: l-4a1314af
src: agent
touches:
  - src/styles/app.css
  - src/app/card-routing.js
  - tests/playwright/card-page-navigation.spec.js
---

## Decided
- Every card and dialog is an iOS-style liquid-glass sheet: full screen on mobile (below 640px), 42rem wide (the help card's width) and up to 90vh high on desktop. Wide forms (brew form, lab results) keep their own width via app-sheet-wide.
- The head starts with one row: back button (left), then the title (.app-sheet-type), action icons in a glass capsule, and on item cards a close X at the far right. On item cards the row shows the type (Brew, Bag, Coffee, Gear) and the item's name sits large below it; on every dialog the row shows the dialog's own title and nothing sits below it.
- Back on an item card goes back in history when opening the card made a history step (a card of another type, opened from a card on another page), so a coffee card opened from a brew card returns to that brew card. Otherwise it closes the card.
- The X is only on brew, bag, coffee and gear cards, which have an overview page under them: it closes the card and stays on that page. Dialogs such as Help, Preferences and About have no page of their own under them, so they only have the back button (which closes them).

## Watch out
- backdrop-filter makes a new stacking context, so the glass action capsule trapped its dropdown menu under the card's content. The head is position relative with z-index 10 to keep the menus on top.
- The panels' Tailwind classes (max-w-sm, bg-white, rounded-xl, text colours) are still in the markup; app.css overrides them with !important or more specific rules. The graph dialog's title is an h2 inside a wrapper div that carries .app-sheet-type, so the title rules also cover nested h2/h3.

In the code: .app-sheet* rules in src/styles/app.css; markup in the *-card.view.html files and the dialog views; goBack and the [data-card-back]/[data-card-close] click listener plus appCard.pushed in src/app/card-routing.js; tests/playwright/card-page-navigation.spec.js.
