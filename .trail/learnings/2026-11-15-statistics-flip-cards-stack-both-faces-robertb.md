---
title: "Statistics flip cards stack both faces in one grid cell that must be held to the card's height"
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 4, tokens: 53090 }
id: l-b9d92662
scope: repo
status: active
src: agent
touches:
  - src/features/stats/stats.js
  - src/features/stats/stats.view.html
  - src/styles/app.css
---

## Decided
Roast Profile, Brew Method and Drink Type show the most common value as a word; a corner button flips the card to the doughnut chart. Both faces sit in the same grid cell and turn with a 3D rotate, so the chart keeps a real size while hidden and Chart.js draws it correctly (display:none would give it zero size).

## Tried and ruled out
A plain grid with auto rows: the back face grew to the canvas's default 300px and made the card taller than the h-48 box.

## Watch out
The grid needs fixed rows and columns (minmax(0, 100%)) and the back face height 100%, or the card grows. After changing app.css the local preview kept the old stylesheet until the service worker was unregistered and its caches cleared.

In the code: .stats-flip* rules in src/styles/app.css (plain CSS, not Tailwind); renderTopShare and wireFlipCards in src/features/stats/stats.js.
