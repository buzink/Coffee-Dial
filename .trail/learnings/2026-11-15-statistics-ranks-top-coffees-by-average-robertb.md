---
title: "Statistics ranks top coffees by average rating and top brews by one brew's rating, one brew per coffee"
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 3, tokens: 77155 }
id: l-520fbb32
scope: repo
status: active
src: agent
touches:
  - src/features/stats/stats.js
---

## Decided
Hall of Fame (all 5-star brews) was replaced by two top-3 cards. Top Coffees ranks coffees by the average rating of their rated brews in the chosen period (ties: more rated brews, then more brews); unrated coffees are left out. Top Brews ranks single brews by rating, newest first on a tie, and shows at most one brew per coffee so one coffee cannot fill the list. Variety Analysis was removed: Unique Coffees and Most Frequent are now tiles in the top row.

## Watch out
Rows open the coffee or brew card only on your own statistics, not on a friend's.

In the code: renderTopList and the topCoffees/topBrews block in src/features/stats/stats.js; cards #topCoffeesList and #topBrewsList in stats.view.html.
