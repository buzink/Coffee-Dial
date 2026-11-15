---
title: "Statistics name a coffee as Name - Farmer with the roaster in brackets, and only the roaster when it has neither"
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 4, tokens: 71356 }
id: l-98c26601
scope: repo
status: active
src: agent
touches:
  - src/core/coffee-display.js
  - src/features/stats/stats.js
---

## Decided
Statistics used to label coffees by roaster (Roaster - Origin (Farmer), and a leaderboard with Roaster / Origin / Blend-Farmer columns), left over from before coffees had a name. They now use the same "Name - Farmer" label as the tables, with the roaster in brackets: "Sakuku - Finca X (Manhattan)". A coffee with no name and no farmer shows just the roaster. The leaderboard has Coffee / Origin / Avg Rating columns.

## Watch out
Stats does not load data in test mode (?e2eSeed=1): the page shows empty values there, so check label changes by calling calculateStats with a fake DOM.

In the code: formatCoffeeWithRoaster in src/core/coffee-display.js; used in src/features/stats/stats.js (beanName, mostBrewedName, top coffees, leaderboard). The stats module now also gets getBeanCoffeeTypeDisplay from app-composition so bag names come from the linked coffee.
