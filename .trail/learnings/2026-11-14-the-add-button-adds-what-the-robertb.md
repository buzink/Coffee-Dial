---
title: "The add button adds what the visible page is about, and brews everywhere else"
author: RobertB
date: 2026-11-14
branch: main
cost: { minutes: 4, tokens: 24633 }
id: l-41e34129
scope: repo
status: active
src: agent
touches:
  - index.html
  - src/features/beans/beans-table.view.html
  - src/features/coffees/coffee-types-table.view.html
  - src/features/gas/gas-table.view.html
  - src/features/shell/shell.view.html
  - src/features/stats/stats.view.html
  - src/styles/app.css
  - src/app/composition/app-composition.js
---

## Decided
- The add button (header on desktop, floating button on mobile) looks at the visible page and calls that page's own add action: beans, coffees and gear add a bean, coffee or gear item; brews, statistics and any page without something to add open the new brew form. Its label is a neutral "Add" so it fits every page.
- The brew route key ("brew") and the pinned tiles still use the brew-only action; only the two add buttons use the page-aware one.

## Watch out
- In test mode (?e2eSeed=1) every create that writes to Firestore fails with permission-denied ("Failed to create bean."), the page's own Add buttons included. That is expected there; check which create ran from the console error ("Error creating bean/coffee/gear item"), not from a saved record.
- A new page with its own add action needs a branch in the page-aware action, or the button falls back to adding a brew.

In the code: openAddForCurrentPage in src/app/composition/app-composition.js (registered in action-assemblies.js systemActions); #menuAddBrewBtn and #fabAddBrewBtn in index.html and src/features/shell/shell.view.html.
