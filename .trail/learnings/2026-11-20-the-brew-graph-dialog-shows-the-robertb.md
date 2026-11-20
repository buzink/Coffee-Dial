---
title: "The brew graph dialog shows the graph first and the name below it in two fixed lines, and an empty graph is as tall as a filled one"
author: RobertB
date: 2026-11-20
branch: main
cost: { minutes: 2, tokens: 81198 }
id: l-b7455883
scope: repo
status: active
src: agent
touches:
  - src/styles/app.css
  - src/features/graph-modals/graph-modals.view.html
  - src/features/brews/brews-card-graph.js
---

## Decided
The user wanted the graph at the top of the Brew Graph dialog with the brew's name under it, the name always taking exactly two lines, and the graph block the same height with or without data, so paging between brews does not make the dialog jump.

## Watch out
The empty/loading message used to sit below the canvas while the canvas stayed visible, which made an empty graph taller. It now lies on top of the canvas (absolute, centered). Do not hide the canvas for the empty state or move the message back into the flow. Its id rule beats Tailwind's .hidden, so a matching `#cardGraphEmpty.hidden` rule is needed.
The browser pane cannot reach a preview server started by another session in this folder (port 4173); start a separate server on another port to verify.

In the code: src/features/graph-modals/graph-modals.view.html (card-graph-frame, cardGraphSubtitle after the frame), src/styles/app.css (.card-graph-frame, #cardGraphEmpty, #cardGraphSubtitle with line-clamp 2 and min-height 2rem). Measured: frame 226 px empty and filled, name 32 px.
