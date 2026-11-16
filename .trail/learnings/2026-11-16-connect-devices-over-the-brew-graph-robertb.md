---
title: Connect Devices over the brew graph starts scale 1 itself and closes once it connects
author: RobertB
date: 2026-11-16
branch: main
cost: { minutes: 1, tokens: 62664 }
id: l-78b1920e
scope: repo
status: active
src: agent
touches:
  - src/features/devices/devices-modals.js
---

## Decided
When the Connect Devices card opens while the brew graph is open (automatically for an empty graph, or with the plug button) and no device is connected at all, it presses Connect for scale 1 itself, so the Bluetooth chooser appears straight away. When scale 1 connects, the card closes and the graph is back in front. A cancelled chooser leaves the card open with "Failed to connect", as with a manual click. Opening the card anywhere else (brew form plug button with the graph closed) does nothing extra.

## Watch out
navigator.bluetooth.requestDevice needs a recent user click. The automatic case relies on the click on the graph button still counting after the lazy imports (Chrome keeps it about 5 seconds). If the imports get much slower, the chooser will be refused and the user has to press Connect.

In the code: openConnectDevicesModal and connectScaleFromGraph in src/features/devices/devices-modals.js (checks #graphModal visible and DeviceManager.hasAnyConnection()).
