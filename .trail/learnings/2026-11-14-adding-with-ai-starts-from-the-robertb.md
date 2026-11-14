---
title: "Adding with AI starts from the Extract button on a new bean or coffee card, not from the page"
author: RobertB
date: 2026-11-14
branch: main
cost: { minutes: 2, tokens: 34744 }
id: l-7cac3d09
scope: repo
status: active
src: agent
touches:
  - src/features/ai-import/ai-import.js
---

## Decided
- The beans, coffees and gear pages have no add buttons of their own; adding goes through the add button in the header (desktop) or bottom right (mobile).
- The AI add moved into the header of the Add bean and Add coffee cards as a neutral "Extract" button with the old Take Photo / From Gallery menu. Choosing one discards the unsaved draft card and then runs the AI add exactly as before (it creates the coffee, and for beans the bag, itself). Gear has no AI add, so its card has no Extract.
- Because the card is closed while the photo is scanned, the header and floating add buttons show a spinner until the scan ends.

## Watch out
- The AI file inputs now live inside the lazily mounted card views; the menu items call the AI trigger first and the card's cancel second, in one action string.

In the code: .app-card-extract in the bean and coffee card views and app.css; showAiScanBusy in src/features/ai-import/ai-import.js.
