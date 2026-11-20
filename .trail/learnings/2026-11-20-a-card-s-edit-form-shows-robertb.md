---
title: "A card's edit form shows only the type in its header, and Cancel or Save is the only way out"
author: RobertB
date: 2026-11-20
branch: main
cost: { minutes: 20, tokens: 106211 }
id: l-0951ff8b
scope: repo
status: active
replaces: l-3f6ede55
src: agent
touches:
  - src/styles/app.css
  - src/app/card-routing.js
  - src/features/ui-shell/ui-shell.js
  - src/features/beans/beans-card-form.js
  - tests/playwright/zz-tmp-edit-check.spec.js
---

## Decided
- The user found "Edit bag" under the "Bag" type a double title, so the separate "Edit <type>" / "Add <type>" line with icon is gone from brew, bag, coffee and gear cards. In edit mode the header shows only the centred type; the item's name is hidden as before.
- While editing, the only way out is Cancel or Save: the back button, the X and the icon capsule are hidden, a click on the dimmed backdrop does nothing and Escape does not close the card. While adding, the capsule stays for Extract, but without the X.
- The bag edit form hides the coffee's own fields (farmer, roaster, origin, process, variety, roast) unless "-- create new coffee --" is chosen; they are edited on the coffee. The read-only Finished date is hidden too (the Finished switch sets it).

## Watch out
- Back and the capsule use visibility: hidden, not display: none, so the type stays centred in the header grid.

In the code: the edit-mode rules next to .app-when-adding in src/styles/app.css; isEditingCard and the backdrop guard in src/app/card-routing.js; the Escape guard in handleEscapeKey (src/features/ui-shell/ui-shell.js); setBeanEditCoffeeTypeFieldState in src/features/beans/beans-card-form.js.
