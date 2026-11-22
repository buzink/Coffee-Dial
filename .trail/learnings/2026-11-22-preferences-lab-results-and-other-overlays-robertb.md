---
title: "Preferences, lab results and other overlays keep their URL key on refresh, like the pages do"
author: RobertB
date: 2026-11-22
branch: main
cost: { minutes: 3, tokens: 92152 }
id: l-ac5d4b4e
scope: repo
status: active
src: agent
touches:
  - src/app/composition/app-composition.js
---

## Decided
Overlay route keys (preferences, lab-results, help, about, ...) behave like page keys: on refresh the key stays in the URL and the overlay reopens. Every opened route key is marked pending for 5 s; the modal-visibility sync keeps a pending key until its modal shows, and drops it only once the modal was visible and is hidden again.

## Tried and ruled out
Only adding the pending rule: closing lab results then left `?lab-results` in the URL. Its back button goes through a dispatcher that bypasses the wrapped close action, and the visibility observer was attached per element at init, so it never saw preferencesModal and labResultsModal, which are mounted lazily later.

## Watch out
The modal observer now watches document.body (subtree, class/style) and filters on the routed modal ids, so lazily mounted modals are covered.

In the code: markPendingPage, pendingOpenTimers, syncRouteFromModalVisibility and modalObserver in initializeHistoryRoutes, src/app/composition/app-composition.js.
