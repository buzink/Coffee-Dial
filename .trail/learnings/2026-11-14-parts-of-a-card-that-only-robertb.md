---
title: "Parts of a card that only show in one mode start with the hidden attribute, not the hidden class"
author: RobertB
date: 2026-11-14
branch: main
cost: { minutes: 2, tokens: 14734 }
id: l-40e022de
scope: repo
status: active
src: agent
touches:
  - src/styles/app.css
---

## Decided
- The Extract button and the Add/Edit header texts on cards carry the HTML hidden attribute in the markup, and app.css shows them only in the right mode ([data-adding], or the card's edit section being open). If app.css is old or missing (the service worker serves cached files first and refreshes them in the background), they simply stay hidden instead of showing on every card.

## Tried and ruled out
- The Tailwind hidden class: app.css makes .hidden display:none !important, so no mode rule can show the element again.

In the code: .app-card-extract, .app-card-mode-title and .app-when-adding in the four *-card.view.html files and src/styles/app.css.
