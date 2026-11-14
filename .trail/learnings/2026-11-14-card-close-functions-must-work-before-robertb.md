---
title: "Card close functions must work before the card was ever opened, because cards load lazily"
author: RobertB
date: 2026-11-14
branch: main
cost: { minutes: 3, tokens: 37213 }
id: l-81618346
scope: repo
status: active
src: agent
touches:
  - src/features/beans/beans-card-ui.js
  - src/features/coffees/coffee-type-card.js
  - src/features/gas/gas-card.js
  - tests/playwright/go-to-brews-navigation.spec.js
  - src/app/lazy-mount.js
---

## Decided
Cards (bean, coffee, gear) are mounted on first open. Cross-links such as "Go to beans/brews" close the card first, so the close functions now return early when the card is not in the DOM yet. Before this, those links silently did nothing until a card had been opened once.

## Watch out
The Playwright navigation test loads with smoke=1, whose smoke checks may open cards first, so it can miss this class of bug. To reproduce, open a page fresh and use a row's action menu without opening any card.
Any new code that touches a lazily mounted overlay must allow it to be missing.

In the code: closeCoffeeTypeCard (src/features/coffees/coffee-type-card.js), closeBeanCard (src/features/beans/beans-card-ui.js), closeGasCard (src/features/gas/gas-card.js); lazy mounts in src/app/lazy-mount.js.
