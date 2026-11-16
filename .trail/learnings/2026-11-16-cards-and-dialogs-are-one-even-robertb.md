---
title: "Cards and dialogs are one even surface: no heading or footer lines, no framed blocks in item cards"
author: RobertB
date: 2026-11-16
branch: main
cost: { minutes: 3, tokens: 37250 }
id: l-5bf3c50b
scope: repo
status: active
replaces: l-ec166359
src: agent
touches:
  - src/styles/app.css
  - src/features/brews/brews-card.view.html
---

## Decided
The user wants cards and dialogs calm like the brew graph modal: only inputs and buttons stand out, because the lines and tinted blocks made the sheets look busy.
- No line under headings or above footers in any card or dialog.
- Footers and other full-width bars share the body's background (one surface from head to footer).
- In the brew, bag, coffee and gear cards, blocks (brew stats, bag price/weight row, photo frames) lose fill and outline, and note paragraphs (Notes, To Improve, Taste Notes) are plain text. The divider between the brew stats rows is gone.
- Kept: the In/Ratio/Out tiles inside brew stats, the confirm dialog's divider, lines in tables and dropdowns. Rounded blocks in Preferences, Devices and other dialogs were left alone, because the user only asked for item cards.

## Watch out
- Done by general CSS keyed on Tailwind tokens (bg-coffee-50, rounded*, bg-yellow-50, bg-red-50), so a new block with those classes is flattened too; otherwise markup still carries the old border/bg classes, overridden with !important.
- Footer top lines and section-heading lines were removed in the markup itself, so copying an old snippet brings them back.

In the code: .app-sheet-head and the .app-sheet-panel / .app-card .app-sheet-panel rules in src/styles/app.css; brew stats grid in src/features/brews/brews-card.view.html.
