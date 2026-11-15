---
title: An empty brew graph with no scale connected opens the Connect Devices card on top
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 1, tokens: 5537 }
id: l-1c57883e
scope: repo
status: active
src: agent
touches:
  - src/app/composition/app-composition.js
  - src/features/media/media-modals.js
  - src/features/brews/brews-form.view.html
---

## Decided
Clicking the graph button in the Add/Edit brew form opens the graph and, when the graph has no capture data and neither scale slot is connected, opens the "Connect Devices" card on top of it. The user first asked for the "Connect scale" card, then corrected it to Connect Devices: the same card the plug button in the graph header opens.

## Tried and ruled out
The single-scale "Connect scale" card (connectScaleModal): the user wants the multi-device card.

## Watch out
There are two connect cards: connectScaleModal (Connect scale, scales feature) and connectDevicesModal (Connect Devices, devices feature). Both are z 10060, above graphModal (z 10040).
While testing in the local preview, the service worker kept running the old module even after a reload. Clear caches and unregister the worker before concluding a change does not work.

In the code: promptScaleConnectIfEmpty in src/app/composition/app-composition.js (checks coffeeScale.getCaptureData(), coffeeScale.isConnected(), DeviceManager.isConnected('scale'/'scale2'), then openConnectDevicesModal, which mounts the devices view itself); called at the end of openGraphModal in src/features/media/media-modals.js; button brewGraphBtn in src/features/brews/brews-form.view.html.
