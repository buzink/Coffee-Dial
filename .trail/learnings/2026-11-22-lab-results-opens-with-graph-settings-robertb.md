---
title: "Lab results opens with Graph settings collapsed and the Flow graph on, and the line key always keeps its space"
author: RobertB
date: 2026-11-22
branch: main
cost: { minutes: 1, tokens: 12959 }
id: l-62c9ba98
scope: repo
status: active
replaces: l-90e32127
src: agent
touches:
  - src/features/brews/lab-results.js
  - src/features/brews/lab-results.view.html
  - src/styles/app.css
---

## Decided
Graphs, Y-axis and X-axis sit in one collapsible "Graph settings" section in Lab results, so the brew tiles (each line's color and number) sit right under the graph. The user wanted it to start collapsed with Flow graph checked, every time the dialog opens.

## Watch out
The line key above the graph (Weight/Flow) is hidden with visibility (invisible), not display:none, so the graph does not jump when you switch graphs or while it loads. Don't switch it back to `hidden`.
The section is a native <details>; the chevron flips with CSS on [open]. Open/closed is reset to closed in openLabResultsModal, not saved.

In the code: src/features/brews/lab-results.js (openLabResultsModal, renderLineKey), src/features/brews/lab-results.view.html (#labResultsGraphSettings, #labResultsLineKey), src/styles/app.css (.lab-graph-settings).
