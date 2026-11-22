---
title: "Lab results weight and flow graphs have no legend; the brew tiles show each line's color and number"
author: RobertB
date: 2026-11-22
branch: lab-graph-legend
cost: { minutes: 5, tokens: 98289 }
id: l-7566a0c3
scope: repo
status: active
src: agent
touches:
  - src/features/brews/lab-results.js
  - src/styles/app.css
---

## Decided
With several brews the Chart.js legend (one entry per brew per graph type, with long names) filled the fixed-height lab results graph and, with flow and weight both on, overflowed it. The user picked: no legend for the weight/flow graphs. Selected brew tiles show a colored dot with the line's number, and a small key above the graph shows the line styles (solid = Weight, dashed = Flow). Tooltips still show the full brew name. Custom graphs keep their legend, because their lines are Y fields, not brews.

## Tried and ruled out
One short legend entry per brew, an HTML legend list under the graph, and a taller graph with the legend on the right: each still grows with the number of brews, or doesn't help on a phone.

## Watch out
Lines are numbered and colored by position among the SELECTED brews, not among all visible brews; the tile dot must use the same index (the old tile number used the visible index and no longer exists). Toggling a graph type now re-renders the tiles, because the dots only show for weight/flow graphs.

In the code: src/features/brews/lab-results.js (showsBrewLines, renderLineKey, renderBrewTiles, legend.display = axisMeta.customMode), #labResultsLineKey in lab-results.view.html, .lab-brew-line-dot in src/styles/app.css.
