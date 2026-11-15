---
title: "After a refresh the statistics page opens before the friends list is loaded, so its My/Friends choice is filled again when the list arrives"
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 18, tokens: 30800 }
id: l-2bd4515d
scope: repo
status: active
src: agent
touches:
  - src/features/social/social.module.js
  - src/styles/app.css
---

## Decided
Statistics fills its My/Friends select when the page opens. After a refresh the page opens from the URL before the following list has loaded, so the select was empty and hidden and never came back. The code that updates the other pages' selects when the following list arrives now also refills the statistics select, keeping what it showed.

## Watch out
The statistics select keeps its own choice (which person's statistics are shown) and is not synced with the brews/bags/coffees/gear view like the others.
The other view selects are 42px high through an id rule in the app stylesheet, so the period select uses the same height to line up.

In the code: updateFriendViewSelectors in src/features/social/social.module.js; .stats-filters rules in src/styles/app.css.
