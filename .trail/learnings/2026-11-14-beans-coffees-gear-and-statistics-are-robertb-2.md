---
title: "Beans, coffees, gear and statistics are pages that replace the brews view, one at a time"
author: RobertB
date: 2026-11-14
branch: main
cost: { minutes: 2, tokens: 18268 }
id: l-ef11bf87
scope: repo
status: active
replaces: l-21a56208
src: agent
touches:
  - index.html
  - src/app/composition/app-composition.js
  - src/app/pages.js
  - src/app/pwa.js
  - src/features/beans/beans-table.view.html
  - src/features/coffees/coffee-types-table.view.html
  - src/features/gas/gas-table.view.html
  - src/features/stats/stats.view.html
  - src/features/ui-shell/ui-shell.js
  - src/styles/app.css
---

## Decided
The four main sections are pages, not overlays. They sit inside <main>, carry `data-app-page="<route key>"`, and are still shown and hidden by their features with the `hidden` class. CSS hides the brews view while one is visible; an observer keeps one page visible at a time and scrolls to the top. Cards and forms stay overlays on top. Escape no longer closes a page; the X goes back to brews.

## Tried and ruled out
Letting the modal-visibility sync drop route keys for pages: statistics opens asynchronously, so it pushed an empty route and Back skipped a step. Page keys are synced only by the page observer.

## Watch out
Only the last page key is kept in the URL; overlay keys still stack.
Local checks: unregister the service worker and refresh changed JS (fetch with cache 'reload'), or the browser runs old modules.

In the code: ids beansPage, coffeeTypesPage, gasPage, statsPage; src/app/pages.js; initializeHistoryRoutes in src/app/composition/app-composition.js; `main:has(...)` and `.app-page-panel` in src/styles/app.css.
