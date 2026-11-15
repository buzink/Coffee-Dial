---
title: "Coffee details live only on the coffee, bags only link it, and a brew's grinder is only a gear link"
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 19, tokens: 257638 }
id: l-100c1525
scope: repo
status: active
src: agent
touches:
  - src/core/coffee-display.js
  - src/features/stats/stats-origins-map.js
  - src/features/stats/stats.js
  - src/features/stats/stats.view.html
  - src/features/stats/world-map.data.js
  - src/styles/app.css
  - src/core/brew-fields.js
  - scripts/migrate-single-source-fields.mjs
  - src/features/brews/brew-grinder-gear-sync.js
  - src/features/import-export/import-export.js
---

## Decided
Brews and bags used to carry copies of the coffee's fields (roaster, farmer, origin, variety, process, roast, and on old brews name/beanType), and brews a grinder name next to their gear links. The copies drifted (an origin emptied on the coffee kept showing from the brew). Now each field lives in one place: the coffee (coffeeTypes) holds all coffee details, a bag (beans) holds bag data plus coffeeTypeId, a brew (coffees) holds brew data plus beanId and gearIds. No code reads or writes the copies; there is no fallback for old data.
- Brew form: with a bag chosen, the coffee fields show the bag's coffee and are read-only (change them on the coffee card). With no bag, typed fields find or create the coffee, and an open bag of that coffee is reused or a new bag made.
- A typed grinder (brew form, quick edit, import) finds or creates grinder gear and only its id is saved. Gear bulk add replaces a brew's previous grinder.
- Statistics loads the viewed person's coffees too, so friends' stats show their own coffee details.
- Imports turn coffee text into a matched or new coffee with one finished bag per coffee.

## Tried and ruled out
Keeping the old migration scripts (sync legacy beans, fill legacy grinder from gear, migrate grinder to gear, extract coffee types from beans): they write the copies back or are superseded; removed.

## Watch out
The migration drops values that differ from the coffee, including some where the coffee's field is empty; its dry run lists them. Moments keep their own snapshot of details (grinder name included) on purpose.

In the code: src/core/brew-fields.js (getBrewGrinderName, getBrewFieldValue, BREW_/BAG_DUPLICATE_FIELDS), createCoffeeDisplayModule in src/core/coffee-display.js, setTypedGrinder in src/features/brews/brew-grinder-gear-sync.js, prepareImportedBrews in src/features/import-export/import-export.js, scripts/migrate-single-source-fields.mjs.
