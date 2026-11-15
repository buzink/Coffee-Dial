---
title: "A coffee is shown as Name - Farmer everywhere, and the Brews Farmer filter stays separate from the Coffee filter"
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 4, tokens: 144319 }
id: l-99d9a1a8
scope: repo
status: active
src: agent
touches:
  - src/core/coffee-display.js
---

## Decided
- Coffees have an optional `name`. Tables label a coffee as "Name - Farmer" (just one when the other is empty or the same), and coffee filter options as "Roaster - Name - Farmer". Both come from one shared helper so every table matches.
- The Brews column formerly "Blend/Farmer" is now "Coffee". Its filter key stays `farmer` but is labelled "Farmer", because the Brews filter list already has a "Coffee" filter (by coffee id); two filters called "Coffee" would be confusing.
- The Bags column formerly "Farmer / Roaster" is now "Coffee": Name - Farmer, with the roaster below it as before.

## Watch out
- The pinned card, statistics, gallery and CSV exports still use only the farmer; they were left as they were on purpose.

In the code: formatCoffeeLabel / formatCoffeeTypeOption in src/core/coffee-display.js; Coffees Name column/filter in coffee-types-table.js and coffee-types-table.selectors.js; edit field coffeeTypeEditName in coffee-type-card.
