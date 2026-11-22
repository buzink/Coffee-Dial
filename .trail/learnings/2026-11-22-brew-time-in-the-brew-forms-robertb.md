---
title: "Brew time in the brew forms is shown as minutes:seconds and saved as seconds"
author: RobertB
date: 2026-11-22
branch: main
cost: { minutes: 3, tokens: 147925 }
id: l-a9f06fe3
scope: repo
status: active
src: agent
touches:
  - src/core/format.js
  - src/features/scales/scales.js
---

## Decided
The user wanted the brew time in Add brew, Edit brew and Quick edit shown as minutes and seconds (8:42) instead of only seconds. The field is a text field with a numeric keyboard; the brew document still stores `time` in seconds.
Typing "185", "3m 5s" or "45s" also works; leaving the field rewrites it as m:ss.

## Watch out
The scale timer also writes into the same Time field, and the graph and average flow read the field back. Any code that reads or writes the field must go through the shared format and parse helpers. A plain Number(field.value) gives NaN for "3:05".
The live timer only runs with a connected scale, so it can't be checked in the preview without one.

In the code: formatBrewTimeInput / parseBrewTimeInput / parseBrewTime in src/core/format.js; fields #time (brews-form.view.html) and #quickEditTime (brews-card.view.html); timer reads/writes in src/features/scales/scales.js.
