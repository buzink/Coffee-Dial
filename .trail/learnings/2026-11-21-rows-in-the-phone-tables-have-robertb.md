---
title: "Rows in the phone tables have one height: two lines for the name, one line for the labels with the stars after them"
author: RobertB
date: 2026-11-21
branch: main
cost: { minutes: 6, tokens: 38470 }
id: l-24de5f0c
scope: repo
status: active
replaces: l-fa58741b
src: agent
touches:
  - src/app/pwa.js
  - src/features/brews/brews-table.js
  - src/styles/app.css
  - sw.js
---

## Decided
The user wants every row in the phone brews, bags, coffees and gear tables to be the same height. The name always takes two lines (a shorter name leaves the second line empty) and a longer one ends in an ellipsis. The labels under it take exactly one line, also when there are none. A label that doesn't fit ends in an ellipsis. Rating stars (brews, coffees) sit inline after the labels and always show.

## Tried and ruled out
Clamping only the name was not enough: coffees with long origin/process labels wrapped to two label lines, and gear without methods had no label line at all, so rows still differed in height.

## Watch out
Before this change a long name made the card wider than the screen. In a table cell, `truncate` on an inline-flex title doesn't stop the cell from growing. The cell now has `width: 100%; max-width: 0`. Gear used to cut its name at 25 characters in JS; that is gone, CSS clamps it now.

In the code:
- classes mobile-row-cell, mobile-row-title, mobile-row-labels, mobile-row-stars in src/styles/app.css
- mobile rows in brews-table.js (generateMobileAccordionRow), beans-table.js, coffee-types-table.js, gas-table.js
