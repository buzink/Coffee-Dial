---
title: "The home tiles are drawn from a small snapshot document, and a warm device loads from the local cache"
author: RobertB
date: 2026-11-13
branch: main
cost: { minutes: 6, tokens: 66266 }
id: l-c620caba
scope: repo
status: active
src: agent
touches:
  - ".github/workflows/README.md"
  - cloud/google-cloud-functions/README.md
  - src/core/gemini-client.js
  - src/core/home-snapshot.js
  - src/features/session-auth-view/session-auth-view.js
  - src/app/runtime/auth-state.js
---

## Decided
Page loads were slow because every start fetched the latest 120 brews from the server, and brew documents carry scale captures: 6 MB of the 6.2 MB for 353 brews. Two changes: a snapshot holding only what the home tiles need (pinned brews without captures, open bags, their coffees, gear, tile preferences) is drawn as soon as the user is known; and once the server has confirmed the full brews collection, later loads attach the live listeners straight away and read from the local Firestore cache.

## Tried and ruled out
Keeping the staged server load on every start: it is only useful on a device without a full local cache.
Saving the snapshot from the first staged batch: pinned brews older than the latest 120 would drop out of it. It is saved only from complete data.

## Watch out
The snapshot is rebuilt after every change that reaches the live listeners and on every load, and written only when its content differs. It is stored in localStorage and in an owner-only document so a new device gets it too.
A cached first listener snapshot is not followed by a second one when nothing changed, so the brews listener asks for metadata changes to learn that the server confirmed the data, and skips drawing for metadata-only events.
If the browser loses the local Firestore cache but keeps the flag, the table waits for the full download; the tiles still show.
The real size problem remains: captures live inside the brew documents.

In the code: src/core/home-snapshot.js (users/{uid}/private/home, localStorage coffeeDial.homeSnapshot.<uid>), applyLocalHomeSnapshot, startFullLoad and isFullCacheReady in src/features/session-auth-view/session-auth-view.js, src/app/runtime/auth-state.js. Measured locally: tiles at 0.4 s instead of 1.9 s, all brews at 0.8 s instead of 4.2 s.
