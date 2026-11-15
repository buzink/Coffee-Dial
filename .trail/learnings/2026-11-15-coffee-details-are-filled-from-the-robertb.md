---
title: "Coffee details are filled from the roaster's own page, only into empty fields, and skipped when the shop has moved on to a newer lot"
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 1, tokens: 1598 }
id: l-9370711c
scope: repo
status: active
src: agent
touches:
  - scripts/admin-utils.mjs
---

## Decided
- Missing coffee details (name, farmer, origin, micro-region, variety, process, roast, taste notes, shop URL) are looked up on the roaster's own product page first; other sellers only for the same lot. Only empty fields are filled; existing values are never overwritten.
- A bag without a price gets the shop's price for a 250 g bag (or its smallest bag), whether the bag is open or finished, because a shop shows its current price, not what was paid. A price for another bag size is not used.
- A coffee's name stays empty when the roaster's title is just the producer or farm already in farmer.
- Robert wanted this only for his own account; Tieme's and the third account are left to their owners.

## Tried and ruled out
- Filling from the current product page when the roaster has since sold a different lot under the same name or URL (LOT61 Nosegrind went from a blend to an Ethiopia; The Picky Chemist reuses pages for new lots): the details would describe another coffee, so those are skipped.
- Listing a few named smallholders as farmer for a community lot (Las Perlitas): an incomplete list, left empty.

## Watch out
- Many shops drop pages once a coffee sells out; some shop URLs point to web.archive.org copies or to the roaster's origin page (Wakuli).
- The bag "Weight (g)" in the app is often what is left in the bag (15, 22, 44 g), not the bag size.

In the code: done as a one-off script against coffee-dial-buzink with the shared helpers in scripts/admin-utils.mjs.
