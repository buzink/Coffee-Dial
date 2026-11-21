---
title: Brew rows on a phone give the name exactly two lines and put the stars after the labels
author: RobertB
date: 2026-11-21
branch: main
id: l-fa58741b
scope: repo
status: active
src: agent
touches:
  - src/features/brews/brews-table.js
  - src/styles/app.css
---

## Decided
The user wants every brew row in the phone brews table to be the same height, so the brew's name always takes two lines (shorter names leave the second line empty) and longer names end in an ellipsis. The rating stars sit inline after the summary labels, not under the roaster.

## Watch out
A long name used to make the card wider than the screen: in a table cell, `truncate` on an inline-flex title does not stop the cell from growing. The cell now gets `width: 100%; max-width: 0`, which keeps it within the table width whatever the content is.

In the code:
- generateMobileAccordionRow in src/features/brews/brews-table.js (classes brew-mobile-title, brew-mobile-cell; headerRatingHtml is rendered after summaryHtml)
- .brew-mobile-title / .brew-mobile-cell in src/styles/app.css (line-clamp 2, height 2.5rem, overflow-wrap: anywhere)
