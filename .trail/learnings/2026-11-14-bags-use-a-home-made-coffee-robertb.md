---
title: Bags use a home-made coffee bag icon that works like a Font Awesome icon
author: RobertB
date: 2026-11-14
branch: main
cost: { minutes: 1, tokens: 16111 }
id: l-e16e8a8d
scope: repo
status: active
src: agent
touches:
  - src/styles/app.css
---

## Decided
- Font Awesome 6.0.0 has no coffee bag, so bags use our own icon: class fa-coffee-bag, a coffee-bag SVG used as a CSS mask over currentColor. Write it like any Font Awesome icon (<i class="fa-solid fa-coffee-bag text-…">); colour and font-size classes work as usual.
- The seedling stays only where it means actual beans (the Bean-o-meter in statistics).

## Watch out
- The icon lives in app.css; if an old app.css is served from the service worker cache the icon is empty until the new file arrives.

In the code: .fa-coffee-bag in src/styles/app.css.
