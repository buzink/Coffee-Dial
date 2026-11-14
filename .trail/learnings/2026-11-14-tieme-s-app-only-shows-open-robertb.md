---
title: "Tieme's app only shows open or pinned coffees on its home screen"
author: RobertB
date: 2026-11-14
branch: main
cost: { minutes: 8, tokens: 26782 }
id: l-60615d56
scope: repo
status: active
src: agent
touches:
  - package.json
  - scripts/README.md
  - scripts/sync-simple-recipes.mjs
---

## Decided
Recipes synced into Tieme's app are written with isOpen true when one of the coffee's beans is still in use (not archived) in Coffee Dial; otherwise the value already in the document is kept, or false for a new one.

## Tried and ruled out
Writing every synced recipe with isOpen false: the data was in the right project and path, but the home screen showed none of it, which looked like the app had moved to another database.

## Watch out
The home screen lists a recipe only when isOpen is not false or pin.methods holds entries, ordered by homeOrder on users/{uid} and then by createdAt. Closed recipes are still in the database and reachable from the app's add (+) list.

In the code: scripts/sync-simple-recipes.mjs (group.inUse, isOpen). Found in the app bundle at tiemej.github.io/coffee-dial-basic (functions Wt/At/Tb).
