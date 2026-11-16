---
title: "Every card, label, dropdown and toast names a coffee as Name - Farmer, never the farmer alone"
author: RobertB
date: 2026-11-16
branch: main
cost: { minutes: 10, tokens: 105577 }
id: l-bb365384
scope: repo
status: active
src: agent
touches:
  - src/core/coffee-display.js
  - src/features/beans/beans.vm.js
---

## Decided
The user wants a coffee named "Name - Farmer" everywhere it is shown, not just in tables and Statistics. They approved each place one by one: bag card title, brew card title, bag label (Name - Farmer - Roaster (opened)), brew graph subtitle, Lab results tiles and graph labels, pinned tiles and pin art, Moments cards/share image/share text ("Coffee: …" instead of "Farmer: …"), brew form bag and coffee dropdowns (Roaster - Name - Farmer), and the coffee/bag created toasts. Where there is neither name nor farmer, the old roaster fallback stays.

## Watch out
- The smoke seed coffee has no name, so a farmer-only label looks right in test mode. To check, give the seed coffee a name temporarily.
- The local preview keeps serving old JS through the service worker; unregister it and clear caches before checking.
- Moments store a coffeeSnapshot in Firestore; older snapshots have no name, so resolveSnapshotForCard fills it from the linked coffee.

In the code: always use formatCoffeeLabel from src/core/coffee-display.js. The bag card view model has a `label` field (src/features/beans/beans.vm.js); the beans.showBeanCreatedToast command takes an optional `name`.
