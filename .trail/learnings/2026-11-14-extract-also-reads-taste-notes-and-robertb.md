---
title: "Extract also reads taste notes, and Gemini's photo address covers shops that block their page but not their images"
author: RobertB
date: 2026-11-14
branch: main
cost: { minutes: 5, tokens: 46946 }
id: l-6f356528
scope: repo
status: active
src: agent
touches:
  - src/core/gemini-client.js
  - src/features/ai-import/ai-import.js
---

## Decided
- The photo and URL prompts ask for tasteNotes (short comma-separated list); new coffees from the Add coffee and Add bag cards get them, and the brew form puts them on the coffee when it is saved, only if that coffee has no taste notes yet.
- The URL prompt also asks for imageUrl. The photo order is: the page in the browser, then Gemini's imageUrl downloaded in the browser, then the fetchShopImage function. Wix shops (The Picky Chemist) block their pages (no CORS) but allow their images on static.wixstatic.com, so the second step gets the photo without the function.

## Watch out
- When testing modules in the page, a dynamic import with ?t= only refreshes that file; its own imports stay cached until the page reloads.

In the code: TASTE_NOTES_RULE and URL_PROMPT in src/core/gemini-client.js; imageUrlHint in src/core/page-image.js; pendingAITasteNotes in src/features/ai-import/ai-import.js.
