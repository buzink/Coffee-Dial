---
title: "A brew or bag linked to a coffee takes its origin from the coffee, even when that field was emptied there"
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 1, tokens: 1392 }
id: l-49765759
scope: repo
status: active
replaces: l-5fd8137d
src: agent
touches:
  - src/core/coffee-display.js
---

## Decided
Brews (and older bags) keep their own copy of the origin from when they were saved. The display used the coffee's origin and fell back to that copy when the coffee's field was empty, so an origin the user removed from the coffee (e.g. "Blend") kept showing in tables and on the statistics map, also after a refresh. When a brew or bag is linked to a coffee, the coffee's origin is now used as is, empty included; the copy is only used for brews and bags without a coffee.

## Watch out
Roaster, farmer, process, variety and roast still fall back to the brew's or bag's copy in the same way, so emptying one of those on a coffee can show the same stale value.

In the code: getCoffeeTypeDisplay and getBeanCoffeeTypeDisplay in src/core/coffee-display.js.
