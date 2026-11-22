---
title: One tap or click on a table row opens its card; phone rows have no expand panel
author: RobertB
date: 2026-11-21
branch: main
cost: { minutes: 1, tokens: 1640 }
id: l-821842ea
scope: repo
status: active
replaces: l-2c9d4cdd
src: agent
touches:
  - src/core/row-open.js
---

## Decided
In the brews, bags, coffees and gear tables a row opens its card overlay directly, because the user wants the card, not an inline details panel. On desktop (wider than 767px) a plain click on a row opens the card. On phones the compact card-style rows have no expandable details panel; one tap opens the card overlay. The desktop-style rows on phone widths (legacy mobile table setting) open on double-click.

## Watch out
Taps on the ⋮ action menu (anything with data-action-click) must not open the card. On desktop rows, buttons, links, inputs (price, stock, dates in the bags table), the action menu, modifier-clicks and text selection must not open it either; keep new interactive elements covered by the selector in the helper.

In the code: src/core/row-open.js bindRowOpen(row, open) for desktop rows; the phone rows keep the data-mobile-accordion-header attribute (only a name, they do not expand) with a click handler that opens the card, in brews-table.js generateMobileAccordionRow, beans-table.js, coffee-types-table.js and gas-table.js.
