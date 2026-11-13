---
title: "A brew's scale captures live in their own document and load only when a graph is shown"
author: RobertB
date: 2026-11-13
branch: main
cost: { minutes: 16, tokens: 624078 }
id: l-171f20d6
scope: repo
status: active
src: agent
touches:
  - src/app/composition/app-composition.js
  - src/app/pwa.js
  - src/app/runtime/auth-state.js
  - src/core/home-snapshot.js
  - src/features/session-auth-view/session-auth-view.js
  - sw.js
  - src/core/brew-graphs.js
  - scripts/migrate-brew-graphs.mjs
  - src/features/brews/brews.repo.js
---

## Decided
Scale captures were 7.2 MB of the 7.6 MB of brew data, so every brew list load carried them. They moved to one graph document per brew; the brew keeps a small flag. The graph is fetched when the card graph opens, when a brew is edited, for the selected brews in lab results when a weight or flow graph is on, for a moment of type graph, and for a JSON export. Existing brews were migrated on 2026-11-13 (222 graphs).

## Tried and ruled out
Writing the captures as plain fields in the graph document: Firestore indexes every sample, and a batch of brews was refused as too big. The captures are stored as one JSON string instead.
Deleting a graph when an edit carries no captures: an edit made while the graph has not loaded would lose it. A save without capture samples leaves the stored graph alone.

## Watch out
Both shapes must stay readable. A browser still running cached old code writes captures inline; inline data wins, and the migration script can be run again to move it.
Repeating or duplicating a brew must drop the flag as well as the captures.
The first drip, max flow and avg flow inputs sit in the graph modal, which is only mounted after it has been opened. Saving an edit used to clear the stored values when the modal was not there; it now keeps them. Values lost that way earlier are not restored.
Locally the service worker keeps serving old modules for several reloads; a test that seems to fail may be running old code.

In the code: src/core/brew-graphs.js, src/features/brews/brews.repo.js (users/{uid}/brewGraphs/{brewId}, hasGraph), scripts/migrate-brew-graphs.mjs, brews-card-graph.js, lab-results.js, gallery.js, import-export.js, brews-actions.js. Rule match /brewGraphs/{brewId} in the gitignored rules file. Backup: gs://coffee-dial-buzink-backup/before-brew-graphs-2026-11-13.
