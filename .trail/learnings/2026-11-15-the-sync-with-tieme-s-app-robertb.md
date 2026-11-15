---
title: "The sync with Tieme's app names a coffee by its name, or its farmer when it has none, and sends origin as micro-region plus country"
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 29, tokens: 158879 }
id: l-89ec6f2a
scope: repo
status: active
src: agent
touches:
  - src/features/brews/brews.vm.js
  - src/core/coffee-display.js
  - src/core/origin-regions.js
  - scripts/split-coffee-origins.mjs
  - scripts/sync-simple-recipes.mjs
---

## Decided
- A coffee is matched and named by `name || farmer` in both directions. Coffees made before the name field existed have no name, so their keys (recipe document ids cd_<hash of roaster|blend>, coffee type lookup roaster|label) stay the same and no duplicates appear.
- Tieme -> Coffee Dial: his `blend` becomes the coffee's name, his `farmer` the farmer, his `origin` the origin country.
- Coffee Dial -> Tieme: `blend` = name (or farmer), `origin` = "Micro-region, Country", because his app has a single origin field.

## Watch out
- Without this rule a coffee with a name but no farmer (Extract now leaves farmer empty for blends) got an empty blend, and all such coffees of one roaster merged into one recipe.
- A dry run over all history (--since 2000-01-01) gave identical output before and after the change; "Bisrat Melaku - Friedhats" shows as new in both, because its brew is older than the last sync.

In the code: scripts/sync-simple-recipes.mjs (coffeeLabel, syncTieme, syncRobert), formatOriginLabel in src/core/origin-regions.js.
