---
title: "A coffee's altitude is free text in metres, and statistics groups coffees as low below 900, middle 900 to 1200, high above 1200"
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 4, tokens: 66902 }
id: l-057e1f04
scope: repo
status: active
src: agent
touches:
  - src/features/stats/stats-origins-map.js
  - src/features/stats/stats.view.html
  - src/styles/app.css
  - src/features/stats/stats.js
---

## Decided
Coffees have an altitude field (MASL) kept as text, because roasters give ranges ("1700-1900") as often as single heights. For counting, the numbers between 100 and 6000 in the text are averaged; text without such a number counts as no altitude. The Altitude card on Statistics draws a mountain outline with two dashed lines for the bands and shows the share of coffees in each band, out of the coffees in the period that have an altitude; the note under it says how many have one. Low is below 900 m, middle 900 to 1200 m (both ends included), high above 1200 m.

## Watch out
Extract (AI import) and the roaster backfill do not fill altitude yet, so it stays empty until it is typed in on the coffee card.

In the code: parseAltitude, altitudeBand, formatAltitude in src/core/altitude.js; renderAltitude in src/features/stats/stats.js; #statsAltitudeChart in stats.view.html; coffeeTypeEditAltitude in coffee-type-card.view.html and saveCoffeeTypeEdits in coffee-type-card.js.
