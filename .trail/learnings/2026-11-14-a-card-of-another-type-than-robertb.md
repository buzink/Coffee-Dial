---
title: "A card of another type than the current page opens on its own page, and every history step remembers its open card"
author: RobertB
date: 2026-11-14
branch: main
cost: { minutes: 4, tokens: 44948 }
id: l-1aa179ae
scope: repo
status: active
src: agent
touches:
  - src/app/card-routing.js
  - tests/playwright/card-page-navigation.spec.js
  - src/app/composition/app-composition.js
---

## Decided
Opening a brew, bean, coffee or gear card while another page is shown moves to that card's page as a new history step, with the card on top; cards of the previous type close. Each history entry keeps the card open in it (history.state.appCard), and Back/Forward reopen it. Closing a card clears it from its entry, so a card closed by hand stays closed after Back.

## Watch out
Cross-links such as "Go to coffee" close their own card before the next card opens (and the next card mounts lazily). So when a card of another type opens, the card that was closed in the same entry within a few seconds is written back into that entry; otherwise Back would not show the brew card again.
New history entries must not copy appCard from the entry they leave; setRoute strips it on push.
Cards are only restored on popstate, not on reload.

In the code: src/app/card-routing.js (createCardRouting, RECENT_CLOSE_MS), the cards list and goToPage in initializeHistoryRoutes in src/app/composition/app-composition.js, test tests/playwright/card-page-navigation.spec.js.
