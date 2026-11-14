---
title: "The My bags/coffees/gear filter text is rebuilt in code, not taken from the page markup"
author: RobertB
date: 2026-11-14
branch: main
cost: { minutes: 1, tokens: 8832 }
id: l-d071d240
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

## Watch out
- The "My …" option in the view filter of each page is rebuilt after load as "My " + a word passed per page, so renaming it only in the HTML is overwritten. The Bags page passes 'bags'; searching for the full text "My beans" did not find it.

In the code: updateFriendViewSelectors / populateSelect in src/features/social/social.module.js.
