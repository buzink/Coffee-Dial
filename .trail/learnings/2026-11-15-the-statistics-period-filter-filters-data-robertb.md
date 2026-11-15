---
title: "The statistics period filter filters data already loaded, and counts a bag when it was open at any time in the period"
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 1, tokens: 1286 }
id: l-151c09ce
scope: repo
status: active
src: agent
touches:
  - src/features/stats/stats.js
---

## Decided
The period choice next to My/Friends (All time, 7 days, 30 days, 3 months, this year, 12 months) filters the brews, gear and bags already loaded for that view. It does not query Firestore again, so switching period is instant and switching view keeps the period.
- Brews count when made in the period.
- Gear counts toward the GAS total when bought in the period (purchasedDate). Gear without a purchase date counts only under All time.
- A bag counts when its open time overlaps the period: opened before the period and finished during or after it also counts, so the open-time cards are not limited to bags opened inside the period.
- Daily Avg divides by the days since the period start, not since the first brew.

## Watch out
Loading a view is async; a counter drops the result of an older load when a newer view was picked meanwhile.

In the code: getPeriodStart, filterByPeriod, changeStatsPeriod in src/features/stats/stats.js; the select is #statsPeriodSelect in stats.view.html; the action is registered in action-assemblies.js and app-composition.js.
