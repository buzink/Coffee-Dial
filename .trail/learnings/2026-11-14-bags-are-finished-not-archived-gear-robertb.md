---
title: "Bags are finished, not archived; gear still archives"
author: RobertB
date: 2026-11-14
branch: main
cost: { minutes: 6, tokens: 37269 }
id: l-15db84e6
scope: repo
status: active
src: agent
touches:
  - index.html
  - src/app/coordinators/coffees.coordinator.js
  - src/core/overlay-host.view.html
  - src/features/beans/beans-actions.js
  - src/features/beans/beans-card-ui.js
  - src/features/beans/beans-card.view.html
  - src/features/beans/beans-table.js
  - src/features/beans/beans-table.view.html
  - src/features/beans/beans.vm.js
  - src/features/brews/brew-form-lookup.js
---

## Decided
- For bags the user sees Finish / Reopen / Finished instead of Archive / Unarchive / Archived (menus, cards, tables, edit form, the empty-bag toast, stats, help). The data field stays `archived` and the ids keep "Archive", so stored data and code are unchanged.
- Gear keeps its Archive wording for now: "finish" does not fit a device.
- The Bean Conqueror export keeps its "Archived" column, because that format expects it.

In the code: archiveLabel in beans-card-ui.js and beans-table.js, status in beans.vm.js, labels in beans-card.view.html, beans-table.view.html and core/overlay-host.view.html.
