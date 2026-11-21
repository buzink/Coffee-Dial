---
title: "A rating always shows five stars, empty ones for the rest, and no dash when there is no rating"
author: RobertB
date: 2026-11-21
branch: main
cost: { minutes: 2, tokens: 73490 }
id: l-a61e158e
scope: repo
status: active
src: agent
touches:
  - src/core/format.js
  - src/styles/app.css
---

## Decided
The user wants every rating to show the full scale of five stars: the rating in yellow, the rest as empty (muted) stars, and five empty stars instead of a dash or nothing when an item has no rating. This holds in the brews and coffees tables (desktop and phone rows) and on the brew and coffee cards.

In the code: one helper, getStarDisplay(rating, sizeClass) in src/core/format.js, draws all stars; phone rows pass 'text-[7px]'. The empty colour is the .star-empty class in src/styles/app.css (light #d6ccc2, dark #57534e).

## Watch out
Don't add a `rating > 0 ?` guard around the stars again; that brings back the empty cell.
