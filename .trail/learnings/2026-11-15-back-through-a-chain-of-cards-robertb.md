---
title: "Back through a chain of cards needs each card's 'opened as a new step' mark kept when its history entry is rewritten"
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 1, tokens: 1090 }
id: l-42fea4ff
scope: repo
status: active
src: agent
touches:
  - src/app/card-routing.js
  - tests/playwright/card-page-navigation.spec.js
---

## Decided
- The back button on a card goes back in history only when the card's history entry is marked as opened in a new step (appCard.pushed); otherwise it just closes the card.
- Whenever the same card is written into its entry again (shown again, or kept as the card a cross-link came from), one helper, withPushedMark, carries the mark over. This makes Back walk a chain like brew → bag → coffee in reverse.

## Watch out
- A cross-link can open the next card before the current card has closed; the current card is then written back into its entry as the card we came from. Without the mark, Back on that card closes it instead of returning to the card before it. Code that writes history.state.appCard for a card that may already be in the entry goes through withPushedMark.

In the code: withPushedMark and onCardShown in src/app/card-routing.js; test "back button walks back through a chain of cards" in tests/playwright/card-page-navigation.spec.js.
