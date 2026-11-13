---
title: Paging through brew graphs must wait for the card to switch and must not let old results draw
author: RobertB
date: 2026-11-13
branch: main
cost: { minutes: 1, tokens: 2202 }
id: l-6fe65993
scope: repo
status: active
src: agent
touches:
  - src/features/brews/brews-card-graph.js
  - src/features/scales/scales.js
---

## Decided
Opening a brew's graph is asynchronous, because the graph is fetched on demand. Paging therefore waits until the brew card has switched before reading its graph, otherwise it reads the previous brew's graph or none. Each open request supersedes earlier ones, because a slower earlier fetch would otherwise draw over a newer brew.

## Watch out
The graph renderer remembers the last graph drawn on a canvas and redraws it on hover. Clearing the canvas left that memory in place, so a brew without a graph showed the previous brew's graph on hover. The empty state now draws an empty graph on purpose, because that is what makes the renderer forget.

In the code: openCardGraphModal and navigateCoffeeCardFromGraph in src/features/brews/brews-card-graph.js (graphOpenRequest, EMPTY_GRAPH); graphRenderCache in renderGraphTo, src/features/scales/scales.js.
