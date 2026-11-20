---
title: Item cards keep one layout from item to item so nothing jumps while paging with the arrows
author: RobertB
date: 2026-11-20
branch: main
cost: { minutes: 5, tokens: 112241 }
id: l-811be620
scope: repo
status: active
src: agent
touches:
  - src/styles/app.css
---

## Decided
The user wants brew, bag, coffee and gear cards not to jump while paging with the arrows. Every element that can appear keeps its room: the title always takes two lines (a longer one is cut off with an ellipsis), subtitle and rating keep their line even when empty, and the brew card's Brew Stats header keeps room for the graph button that only some brews have. On desktop the card has one fixed height (90vh) with the body scrolling inside, because the overlay centres the card vertically and any change in content height moved the whole card, arrows included. Mobile was already full screen.

## Watch out
A new element on a card that shows for some items and not others makes the card jump again unless it keeps its room (min-height or visibility instead of display none).
When checking in the local preview, the browser's HTTP cache kept the old app.css; fetch it with cache: 'reload' before reloading. The first measurement right after opening a card is off by ~5px because of the opening animation.

In the code: src/styles/app.css, the block after the [data-adding] rules ("Item cards ... keep the same layout").
