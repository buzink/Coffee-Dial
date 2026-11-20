---
title: "The brew graph sits in the Extraction section of the brew form, not in its own dialog"
author: RobertB
date: 2026-11-20
branch: main
cost: { minutes: 1, tokens: 1415 }
id: l-dfb133b8
scope: repo
status: active
replaces: l-1c57883e
src: agent
touches:
  - src/features/brews/brews-form.view.html
  - src/styles/app.css
  - src/app/composition/app-composition.js
  - src/features/devices/devices-modals.js
  - src/features/scales/scales.js
---

## Decided
The user wanted the graph and everything from the graph dialog in the Add/Edit brew form itself. The graph is a full-width row under Temp; In/Ratio/Out, Time, First drip/Max flow/Avg flow, the Auto/Swirls/Pours toggles, the Weigh/Timer/Reset buttons and the pour/swirl log follow below it. Fields and buttons that existed twice (In/Ratio/Out and Time copies, a second set of Weigh/Timer/Reset, a second plug button and device indicators) are now one set, and the graph button in the Extraction header is gone. The read-only graph dialog that opens from a brew card (cardGraphModal) and the lab results are unchanged.

"Jump to graph after repeat" now scrolls to the graph in the form; when the graph is empty and no scale is connected it opens Connect Devices and starts scale 1 (the Repeat click is the user gesture Bluetooth needs).

## Tried and ruled out
Checking "is the graph dialog visible" to decide whether Connect Devices should start scale 1 itself: the graph is always in the form now, so the plug button would start Bluetooth every time. The caller passes autoConnectScale instead.

## Watch out
- The canvas is drawn at its on-screen width, and the form is hidden while it loads a brew. A ResizeObserver on the canvas redraws it when the form opens, Extraction expands or the window resizes.
- Headless Playwright closes the page as soon as requestDevice opens the Bluetooth chooser; stub navigator.bluetooth.requestDevice in an init script to test the Repeat chain.

In the code: #brewGraphPanel, #graph, #flow, graphFirstDrip/graphMaxFlow/graphAvgFlow, the graph*Toggle inputs and #graphEventLog in src/features/brews/brews-form.view.html; .brew-full-row in src/styles/app.css; showBrewGraph in src/app/composition/app-composition.js (passed to brews-actions for jumpToGraphAfterRepeat); openConnectDevicesModal({ autoConnectScale }) in src/features/devices/devices-modals.js; bindGraphControls in src/features/scales/scales.js.
