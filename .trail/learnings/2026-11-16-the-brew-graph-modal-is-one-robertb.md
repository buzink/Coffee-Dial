---
title: "The brew graph modal is one even background: only input fields and buttons stand out"
author: RobertB
date: 2026-11-16
branch: main
cost: { minutes: 2, tokens: 19956 }
id: l-b8fe58f3
scope: repo
status: active
replaces: l-02bd7639
src: agent
touches:
  - src/features/graph-modals/graph-modals.view.html
  - src/styles/app.css
---

## Decided
The user found the graph modal in the Add brew form too busy and couldn't find the buttons. The graph, Flow/Time, the In/Ratio/Out block, the First drip/Max flow/Avg flow block and the toggle rows have no outline and no background of their own: the whole sheet is one even background. Only the input fields keep a color of their own and an outline (they look recessed), and the buttons (IN, Start, Reset) are filled, have a small shadow and use bold text. The user asked for no new colors, and dark mode mattered most to them. The read-only graph that opens from a brew card was left as it was.

## Watch out
- Without the cards, Flow/Time and the two toggle columns run together, so they got wider column gaps.
- The button style and the toggle gap are plain CSS in the app stylesheet, because the generated Tailwind file is out of date (gap-8 and the dark hover color are missing).
- In the local preview, app.css stays cached until its link is reloaded with a query string. When the Browser pane is hidden, screenshots stay stale until the viewport is resized.

In the code: src/features/graph-modals/graph-modals.view.html (#graphModal; Flow/Time grid gap-6), src/styles/app.css (.graph-toggle-grid column-gap 1.5rem; .graph-action-btn: light #f2e8e5/#e0ccbb, dark #44403c/#57534e).
