---
title: "Page titles are only shown in the mobile header, never inside the page"
author: RobertB
date: 2026-11-14
branch: main
cost: { minutes: 3, tokens: 107893 }
id: l-e8fb3a15
scope: repo
status: active
src: agent
touches:
  - src/styles/app.css
  - index.html
---

## Decided
- Inside a page the title (h3) is visually hidden at every width but kept for screen readers. On desktop the highlighted header link says where you are; on mobile the header shows the current page's title with its icon, centred between the menu and profile buttons.
- The mobile header title is pure CSS: the header holds one span per page and `body:has(#<page>:not(.hidden))` shows the right one, the same way the header and bottom-bar links are highlighted. Brews shows when no page is visible. It is hidden when signed out (follows #bottomNav's hidden class).
- On mobile the gap between the menu button and the first element on the page is 24px, the vertical gap between the chart cards on Statistics (the 2×2 tiles there are 16px apart; the user asked for "the gap between the cards" and the chart cards are the majority).

## Watch out
- A new page needs a span in the header title (index.html and shell.view.html both hold a copy of the header) plus a selector in the CSS list, or it shows no mobile title.
- The 24px gap comes from main's mobile padding-top (0.875rem) and depends on the 4rem header and 2.75rem menu button; change one and the padding must change.

In the code: src/styles/app.css (.app-page-title, .app-header-title, mobile media query), .app-page-head on the beans, coffees, gear and stats page views.
