---
title: "Beans, coffees, gear and statistics are pages that replace the brews view, one at a time"
author: RobertB
date: 2026-11-14
branch: main
cost: { minutes: 8, tokens: 148474 }
id: l-21a56208
scope: repo
status: active
src: agent
touches:
  - src/app/pages.js
  - src/app/composition/app-composition.js
  - src/styles/app.css
  - index.html
---

## Decided
The four main sections stopped being overlays. Their elements still exist with the old ids (beansModal, coffeeTypesModal, gasModal, statsModal) and are still shown and hidden by their features with the `hidden` class, so none of the coordinators had to change. What makes them pages: they sit inside <main>, carry `data-app-page="<route key>"`, and CSS hides the brews view while one of them is visible. A small observer keeps at most one page visible and scrolls to the top when a page opens.
Cards and forms (bean card, coffee card, gear card, brew card, brew form) stay overlays on top of a page.
Escape no longer closes a page; it only closes overlays. The X in a page header goes back to brews, since the header has no Brews item yet.

## Tried and ruled out
Letting the existing modal-visibility sync drop route keys for pages: statistics mounts and opens asynchronously, so for a moment no page is visible and the sync pushed an empty route into the history. Back then skipped a step. Page keys are now kept in step only by the page observer, which waits for a page that is still on its way.

## Watch out
Page route keys are exclusive (only the last one is kept in the URL); overlay keys still stack.
When checking this locally, unregister the service worker first: it serves the old code cache-first and makes a fixed bug look unfixed.

In the code: src/app/pages.js (PAGE_ROUTE_KEYS, initPages), the router in initializeHistoryRoutes in src/app/composition/app-composition.js (PAGE_ROUTE_KEY_SET, pendingPageKey, onPageChange), the `main:has(...)` rule and `.app-page-panel` in src/styles/app.css, mounts moved into <main> in index.html.
