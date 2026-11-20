---
title: "Editing a brew offers every bag, grouped as Open, Frozen and Finished, and the list refreshes while the edit is open"
author: RobertB
date: 2026-11-20
branch: main
cost: { minutes: 5, tokens: 104807 }
id: l-e30d3552
scope: repo
status: active
src: agent
touches:
  - src/features/brews/bag-options.js
---

## Decided
When a brew is edited (brew card quick edit or the Edit brew form) the bag drop-down lists every bag, in groups Open, Frozen and Finished (finished wins over frozen), newest opened first within a group. The Add brew form still offers only open bags, ungrouped.
The startup load only fetches open bags (archived == false, frozen == false) and may answer from a stale local cache, so a bag made elsewhere can be missing until the live listeners arrive. The bag lists therefore refresh on every bags update, also while the edit is open, keeping the chosen bag.

## Watch out
updateBeanDropdown without includeAll now follows the form's editing-mode class; the new-brew paths (reset, duplicate, friend repeat) pass includeAll: false explicitly.

In the code: src/features/brews/bag-options.js (buildBagOptionsHtml), brew-form-lookup.js updateBeanDropdown, populateBrewQuickEditBeanOptions in brews-card-actions.js, and the updateBeanDropdown wrapper in app-composition.js that also refreshes #quickEditBeanId.
