---
title: "Cards and dialogs are glass sheets with a back button top left; only brew, bag, coffee and gear cards also get a close X"
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 1, tokens: 5985 }
id: l-4a1314af
scope: repo
status: active
replaces: l-2b4a0115
src: agent
touches:
  - src/styles/app.css
  - src/app/card-routing.js
  - tests/playwright/card-page-navigation.spec.js
---

## Decided
- Every card and dialog is an iOS-style liquid-glass sheet: full screen on mobile (below 640px), 42rem wide (the help card's width) and up to 90vh high on desktop. Wide forms (brew form, lab results) keep their own width via app-sheet-wide.
- The head has an icon row on top: back button (left), the card's type or the dialog's title, action icons in a glass capsule, and on item cards a separate close X at the far right. Other dialogs keep their large title below the row.
- Back on an item card goes back in history when opening the card made a history step (a card of another type, opened from a card on another page), so a coffee card opened from a brew card returns to that brew card. Otherwise it closes the card.
- The X is only on brew, bag, coffee and gear cards, which have an overview page under them: it closes the card and stays on that page. Dialogs such as Help, Preferences and About have no page of their own under them, so they only have the back button (which closes them).

## Watch out
- backdrop-filter makes a new stacking context, so the glass action capsule trapped its dropdown menu under the card's content. The head is position relative with z-index 10 to keep the menus on top.
- The panels' Tailwind classes (max-w-sm, bg-white, rounded-xl) are still in the markup; app.css overrides them with !important.

In the code: .app-sheet* rules in src/styles/app.css; markup in the *-card.view.html files and the dialog views; goBack and the [data-card-back]/[data-card-close] click listener plus appCard.pushed in src/app/card-routing.js; tests/playwright/card-page-navigation.spec.js.
