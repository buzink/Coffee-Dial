---
title: Screenshotting the brew form at phone width needs a script click on the Add button
author: RobertB
date: 2026-11-20
branch: main
cost: { minutes: 3, tokens: 65554 }
id: l-b326b927
scope: repo
status: active
src: agent
touches:
  - src/styles/app.css
---

## Decided
For a quick mock-up of the brew form at phone width, a headless Playwright script that opens the form and changes styles on the page is enough. Nothing in the app has to change.

## Tried and ruled out
- Clicking the Add button the normal way at 390 px wide: the button is in the DOM but hidden at that width, so Playwright waits until it times out.
- Waiting for commandFlows.status in the smoke report to stop being "pending": that timed out in a standalone script. A fixed wait of about 6 s worked.

## Watch out
- Form controls are a mix of heights. Most fields are 38 px, the header buttons are already 44 px, and the five small number fields under the brew graph (In, Out, First drip, Max flow, Avg flow) are 34 px.
- The form body scrolls. To get the whole form in one screenshot, make the viewport as tall as the body's scrollHeight plus about 200 px.

In the code: page `index.html?smoke=1&e2eSeed=1` on port 4173; open the form with `document.querySelector('#menuAddBrewBtn').click()` in page.evaluate; the scrolling container is `#brewFormModalBody`. The temperature step buttons are 2.375rem (38 px), set by `.temp-step-btn` in src/styles/app.css.
