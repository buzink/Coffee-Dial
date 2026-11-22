---
title: "Lab results groups the Graphs, Y-axis and X-axis choices in one collapsible Graph settings section"
author: RobertB
date: 2026-11-22
branch: main
cost: { minutes: 1, tokens: 71762 }
id: l-90e32127
scope: repo
status: active
src: agent
touches:
  - src/features/brews/lab-results.view.html
  - src/styles/app.css
---

## Decided
The user wanted the graph settings in Lab results collapsible like the accordions in the Add brew form, so the brew tiles (with each line's color and number) sit right under the graph. Graphs, Y-axis and X-axis all go inside one "Graph settings" section; it starts open.

## Watch out
It is a native <details>, so the chevron flips with CSS on [open], with no JS toggle like the brew form's Extraction section. The open/closed state is not saved: it lasts while the app is open and resets on reload.

In the code: src/features/brews/lab-results.view.html (#labResultsGraphSettings), src/styles/app.css (.lab-graph-settings rules).
