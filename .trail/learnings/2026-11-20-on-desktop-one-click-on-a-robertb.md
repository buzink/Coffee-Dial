---
title: On desktop one click on a table row opens its card; phone widths keep double-click
author: RobertB
date: 2026-11-20
branch: main
cost: { minutes: 1, tokens: 2925 }
id: l-2c9d4cdd
scope: repo
status: active
src: agent
---

## Decided
In the brews, bags, coffees and gear tables a plain click on a row opens its card when the window is wider than 767px; that is how the user wants desktop to work. At 767px and below the desktop-style rows (legacy mobile table) open on double-click, and the mobile accordion rows keep their own tap logic, because the user wants phones to behave as before.

## Watch out
Clicks on buttons, links, inputs (price, stock, dates in the bags table), the action menu and modifier-clicks must not open the card, and selecting text must not either. Keep new interactive elements in rows covered by the selector in the helper.

In the code: src/core/row-open.js bindRowOpen(row, open), used in brews-table.js, beans-table.js, coffee-types-table.js and gas-table.js instead of row.ondblclick.
