---
title: "The Add brew form follows the graph modal look: no lines under section headings, scale buttons at the bottom of Extraction"
author: RobertB
date: 2026-11-16
branch: main
cost: { minutes: 13, tokens: 56008 }
id: l-4d499445
scope: repo
status: active
src: agent
touches:
  - src/app/pwa.js
  - src/features/brews/brew-form-ui.js
  - src/features/brews/brews-form.view.html
  - src/features/graph-modals/graph-modals.view.html
  - src/styles/app.css
  - sw.js
---

## Decided
The Add brew form got the same calm look as the brew graph modal. The In/Ratio/Out block has no outline or background, and Weigh/Timer/Reset use the raised button style. They sit as a full-width row at the bottom of the Extraction section, below Time. The Bag, Extraction and Cupping headings have no line underneath.

## Watch out
- The section toggles change the heading's classes when a section is collapsed or expanded. They used to add the underline back on expand, so removing it from the markup alone was not enough. Only the bottom padding is toggled now.
- The full-width button row needs grid-column 1 / -1 in plain CSS: the built Tailwind file has no col-span-full or lg:col-span-4.

In the code: src/features/brews/brews-form.view.html (.brew-scale-actions after #time), src/features/brews/brew-form-ui.js (collapse toggles: pb-2 only), src/styles/app.css (.brew-scale-actions, .graph-action-btn).
