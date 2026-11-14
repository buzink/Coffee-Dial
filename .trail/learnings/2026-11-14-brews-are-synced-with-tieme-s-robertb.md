---
title: "Brews are synced with Tieme's app by a script that only writes Tieme's data here and Robert's recipes there"
author: RobertB
date: 2026-11-14
branch: main
cost: { minutes: 5, tokens: 179086 }
id: l-db3a2feb
scope: repo
status: active
src: agent
touches:
  - scripts/sync-simple-recipes.mjs
---

## Decided
Tieme's app stores one "simpleRecipes" document per coffee, holding only the current recipe per method and drink (methods[method][drink] = dose, out, grind, ...), with no date per brew. Coffee Dial stores one document per brew. The sync turns each method/drink of a Tieme recipe into one brew (plus a bean and, if no coffee type with the same roaster and name exists, a coffee type), and folds Robert's brews into one recipe document per coffee (roaster + name), newest brew per method and drink winning.
Start date per run: for Tieme, the newest createdAt among his brews in coffee-dial-buzink; for Robert, coffeeDial.lastBrewAt on the recipe documents the script wrote. Fixed document ids (sr_..., cd_...) make overlapping runs harmless.
The script reads with the active gcloud account, because application-default credentials expire and need a browser login.

## Watch out
A recipe document's createdAt never changes, so a drink Tieme adds later to an older coffee is not picked up from the start date; run with --since to catch it.
Robert's newer brews keep roaster and name null and only point to a bean, which points to a coffee type; resolve through both.
Brews still being made have a negative or zero ratio; they are skipped.
Robert's simpleRecipes already held a hand-made "test - test" document; the script ignores documents it did not write.

In the code: scripts/sync-simple-recipes.mjs (WRITABLE + assertWritable guard the allowed paths), npm run sync:simple-recipes:dry / :apply. UIDs: Tieme VwgxGenwr6ac3m7eKYOnRdxG4Sy1, Robert VNV0hhvFbbTRwvDaiUqxZY0km3L2.
