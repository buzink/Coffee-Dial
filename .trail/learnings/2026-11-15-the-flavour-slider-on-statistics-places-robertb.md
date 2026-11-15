---
title: "The Flavour slider on Statistics places brews from Classic to Wild by a weighted average of roast, process, origin, altitude and variety"
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 5, tokens: 140519 }
id: l-2958b943
scope: repo
status: active
src: agent
touches:
  - src/app/coordinators/coffees.coordinator.js
  - src/core/altitude.js
  - src/core/coffee-display.js
  - src/features/coffees/coffee-type-card.js
  - src/features/coffees/coffee-type-card.view.html
  - src/features/coffees/coffees.vm.js
  - src/features/stats/stats.js
  - src/features/stats/stats.view.html
  - src/styles/app.css
  - src/core/flavour-profile.js
---

## Decided
- The Flavour card follows Daddy Got Coffee's video "Stop Buying the Wrong Coffee" (youtube AdVwUOiZC7Q): four zones Classic (nuts · caramel), Balanced (toffee · sweetness), Bright (berries · florals), Wild (tropical · funky) on a 0–100 slider.
- Only the five clues from the video that also have a card on Statistics count: roast level, process, origin, altitude, variety. Each clue gives a position; a brew's position is their weighted average, weights 5 / 4 / 2 / 1.5 / 1 in the video's order of importance. Unknown clues drop out and the others are re-weighted.
- Per the video: no roast on the bag counts as light-medium (50); a dark roast flattens the other clues, so Dark weighs ×2 and Medium-Dark ×1.5; a co-ferment/infused process "overrides almost everything", so it weighs ×3.
- The slider averages brews, not coffees, so a coffee brewed often pulls harder; it uses the brews in the chosen period. A brew whose coffee has none of the five fields is left out (not counted as light-medium).
- The flip side shows each clue's own average position, its weight and from how many brews; an assumed roast is not shown there.

## Watch out
- Process, origin and variety are free text, so they are matched with regexes; a value that matches nothing (e.g. a variety like Caturra, most of them per the video) simply doesn't count.
- Honey/pulped natural must be matched before natural, and experimental/anaerobic before washed or natural.

In the code: src/core/flavour-profile.js (scores and weights), src/features/stats/stats-flavour.js (render), card markup in src/features/stats/stats.view.html above Roast Profile, styles .flavour-* in src/styles/app.css. Flip-button titles can be set per card with data-title-front/data-title-back.
