---
title: "In the brew graph modal, cards have no outline, inputs are outlined and buttons are filled and raised"
author: RobertB
date: 2026-11-16
branch: main
cost: { minutes: 3, tokens: 99298 }
id: l-02bd7639
scope: repo
status: active
src: agent
touches:
  - src/styles/app.css
  - src/features/graph-modals/graph-modals.view.html
  - src/features/scales/scales.js
---

## Decided
The user found the graph modal in the Add brew form too busy and couldn't find the buttons. The cards (graph, Flow, Time, the In/Ratio/Out block, the First drip/Max flow/Avg flow block) and the toggle rows no longer have outlines and share one soft background. Input fields keep their outline and a recessed look. Buttons (IN, Start, Reset) are filled, have a small shadow and use bold text. The user asked for no new colors, and dark mode mattered most to them. The read-only graph that opens from a brew card was left as it was.

## Watch out
- The button style lives in the app stylesheet as plain CSS, because the generated Tailwind file is out of date (its dark hover color was missing).
- In the local preview, app.css stayed cached until its link was reloaded with a query string. When the Browser pane is hidden, screenshots stay stale until the viewport is resized.

In the code: src/features/graph-modals/graph-modals.view.html (#graphModal), src/styles/app.css (.graph-action-btn: light #f2e8e5/#e0ccbb, dark #44403c/#57534e).
