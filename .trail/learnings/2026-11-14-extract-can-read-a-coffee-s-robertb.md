---
title: "Extract can read a coffee's web page through Gemini, because the browser cannot fetch other sites"
author: RobertB
date: 2026-11-14
branch: main
cost: { minutes: 3, tokens: 41009 }
id: l-96affe7c
scope: repo
status: active
src: agent
touches:
  - src/app/composition/app-composition.js
  - src/features/stats/stats-ai-profile.js
  - src/features/stats/stats.js
  - src/features/stats/stats.view.html
  - src/styles/app.css
  - src/core/gemini-client.js
  - src/features/ai-import/ai-import.js
---

## Decided
- All three Extract menus (Add brew form, Add bag card, Add coffee card) have Take Photo, From Gallery and From URL. From URL asks for an address and lets Gemini read the page with its url_context tool; the app has no backend and the browser cannot fetch other sites (CORS), so it does not download the HTML itself.
- The URL and photo paths share one runner per target that takes { data, compressedFile }; with a URL there is no file, so a new bag or coffee gets no image.
- The brew form's AI button is now "Extract" with the same neutral style as the card Extract buttons.

## Watch out
- Gemini does not allow the url_context tool together with JSON mode, so the answer is parsed as text; the parser also finds a JSON object inside surrounding text.
- In test mode the AI key lives in localStorage under coffeeDial.aiSettings.e2e-user; the URL flow was checked with a stubbed Gemini response, not a real page.

In the code: analyzeCoffeeBagUrl and parseBagFields in src/core/gemini-client.js; runBrewFormExtract, runBagExtract, runCoffeeExtract, fromUrl in src/features/ai-import/ai-import.js.
