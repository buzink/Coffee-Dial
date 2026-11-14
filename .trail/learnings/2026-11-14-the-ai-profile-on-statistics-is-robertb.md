---
title: The AI profile on Statistics is saved per view in the owner-only private document
author: RobertB
date: 2026-11-14
branch: main
cost: { minutes: 3, tokens: 44213 }
id: l-8487b4e5
scope: repo
status: active
src: agent
touches:
  - src/features/stats/stats-ai-profile.js
---

## Decided
- The AI profile now lives in its own full-width card on Statistics (below Lab results) instead of a header button and a dismissable box. Generating puts the text in the card, saves it and turns the button into Regenerate; opening Statistics or switching the view (own brews or a friend's) loads the saved text for that view.
- It is stored in users/{uid}/private/aiProfile as profiles.<view> = { text, generatedAt }, where view is 'mine' or the friend's uid. The existing owner-only rule for private/{docId} covers it, so no rules change or deploy was needed, and followers cannot read it.

## Watch out
- In test mode (?e2eSeed=1) Statistics has no brews (it reads Firestore directly), so the button only says there is nothing to analyse; the module was checked by importing it with a stub database and a stubbed Gemini response.

In the code: src/features/stats/stats-ai-profile.js (showSavedAIProfile, triggerAIProfile); openStats/changeStatsView wrappers in app-composition.js; #aiProfileCard in stats.view.html.
