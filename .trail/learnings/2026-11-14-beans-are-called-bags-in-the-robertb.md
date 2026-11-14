---
title: "Beans are called bags in the app, but only in visible text"
author: RobertB
date: 2026-11-14
branch: main
cost: { minutes: 3, tokens: 37767 }
id: l-14a9f9ad
scope: repo
status: active
src: agent
touches:
  - index.html
  - src/app/composition/action-assemblies.js
  - src/app/composition/app-composition.js
  - src/app/coordinators/beans.coordinator.js
  - src/app/coordinators/coffees.coordinator.js
  - src/app/coordinators/gas.coordinator.js
  - src/app/runtime/open-add-brew.js
  - src/core/draft-items.js
  - src/core/home-snapshot.js
  - src/features/ai-import/ai-import.js
---

## Decided
- The items on the beans page are called bags / bag everywhere the user reads them (navigation, page, cards, forms, links, messages, help). Ids, function names, data fields, Firestore collections and the ?beans URL key stay "beans", so old links and stored data keep working.
- Text about the coffee beans themselves stays: "Beans left" (grams still in the bag), the Bean-o-meter and "Beans Consumed" stats, and the product name Bean Conqueror.

## Watch out
- A Playwright test clicks the "Go to bags" button by its text; renaming visible text can break tests that select by name.
- Font Awesome 6.0.0 in vendor/ has no coffee-bag icon; the seedling is still used until a bag icon is chosen.

In the code: visible strings in index.html, shell.view.html, the beans/brews/coffees/stats/ui-shell/import-export views and scripts; tests/playwright/go-to-brews-navigation.spec.js.
