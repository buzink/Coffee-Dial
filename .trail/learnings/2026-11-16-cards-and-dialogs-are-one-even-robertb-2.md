---
title: "Cards and dialogs are one even surface, and item cards have no framed blocks at all"
author: RobertB
date: 2026-11-16
branch: main
cost: { minutes: 3, tokens: 8352 }
id: l-f72f186c
scope: repo
status: active
replaces: l-5bf3c50b
src: agent
touches:
  - src/app/pwa.js
  - src/features/brews/brews-card.view.html
  - sw.js
  - src/styles/app.css
---

## Decided
The user wants cards and dialogs calm like the brew graph modal: only inputs and buttons stand out, because lines and tinted blocks made the sheets look busy.
- No line under headings or above footers in any card or dialog; footers share the body background.
- Brew, bag, coffee and gear cards have no framed or tinted blocks: brew stats (including the In/Ratio/Out tiles, which the user asked to flatten later too), the bag's price/weight row, photo frames and note paragraphs are plain.
- Kept, because they are not under a heading or in an item card: the confirm dialog's divider, lines in tables and dropdowns, rounded blocks in Preferences and Devices.

## Watch out
- Most of it is general CSS keyed on Tailwind tokens (bg-coffee-50, rounded*, bg-yellow-50, bg-red-50), so a new block with those classes is flattened too; markup still carries old border/bg classes overridden with !important.
- Footer top lines, section-heading lines and the In/Ratio/Out tiles were changed in the markup itself, so copying an old snippet brings them back.

In the code: .app-sheet-head and the .app-sheet-panel / .app-card .app-sheet-panel rules in src/styles/app.css; brew stats in src/features/brews/brews-card.view.html.
