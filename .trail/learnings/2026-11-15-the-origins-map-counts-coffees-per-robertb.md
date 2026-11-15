---
title: "The origins map counts coffees per macro-region and micro-region, and a selected country swaps its labels for its micro-regions"
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 2, tokens: 26745 }
id: l-a707322a
scope: repo
status: active
src: agent
touches:
  - src/features/stats/stats-origins-map.js
  - src/styles/app.css
---

## Decided
The macro-regions (Latin America, Africa & Arabia, Asia & Pacific) sit in the card's top right, level with the title, with the number of different coffees from each; a blend across regions counts in each. The country labels stay on one line: labels that do not fit are hidden, and they are measured again when the width changes. Tapping a country on the map or its label selects it: the caption shows its totals and its micro-regions (coffees per region, "No region" last) replace the country labels. A tap anywhere else deselects, including another spot in the card; a tap on another country selects that one. Hover no longer selects, so it cannot fight the tap. A micro-region only counts for a coffee from a single country.

## Watch out
Selection is driven by one capture-phase click listener on the document, replaced on every render (module-level activeOriginsClick), so stale maps do not keep listeners. The labels are measured after render; when Statistics is hidden the list has no width, so the ResizeObserver does the first real fit.

In the code: renderOriginsMap (select, deselect, renderRegions) and fitOnOneLine in src/features/stats/stats-origins-map.js; #statsOriginsMacro and #statsOriginsRegions in stats.view.html; .origins-card, .origins-map-macro, .origins-map-regions in src/styles/app.css.
