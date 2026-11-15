---
title: "A coffee's farmer field holds only who grew or processed it; blend, product and place names go in its name"
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 13, tokens: 81921 }
id: l-b5f47932
scope: repo
status: active
src: agent
touches:
  - package.json
  - scripts/split-coffee-origins.mjs
  - scripts/sync-simple-recipes.mjs
  - src/app/composition/app-composition.js
  - src/app/container.state.js
  - src/app/coordinators/coffees.coordinator.js
  - src/app/stores/beans-table.selectors.js
  - src/app/stores/brews-table.selectors.js
  - src/app/stores/coffee-types-table.selectors.js
  - src/core/coffee-display.js
---

## Decided
- Farmer = a person, farm (Finca/Fazenda/Hacienda), cooperative, producer group or washing station. Everything else the roaster calls the coffee goes in name: blend and product names (Zimzala, Nosegrind, Red holiday), lot names (Las Perlitas, Ireme) and coffees named after a place (Gedeb, Bookkisa, Huila Pitalito, Burundi Gasura).
- A field holding both is split: "Elixir (Gold Mountain)" -> name Elixir + farmer Gold Mountain; "Los Patios Geisha" -> name Los Patios Geisha + farmer Los Patios.
- When the grower can't be found, Robert keeps the text as farmer (Golo Labe); a growers' committee counts as farmer (La Higuera).
- Bags and brews keep their own copy of farmer, used when the coffee has none; when a coffee's farmer changes, update those copies too, or the Brews Farmer filter keeps listing the old text.

## Tried and ruled out
- Putting place-named coffees in farmer: a place is not who grew it.
- Moving mixed fields whole into name: loses the producer.

## Watch out
- Splitting changes the coffee's label (name || farmer), so a sync with Tieme's app run with --since over older brews makes new recipe documents for those coffees (done for Ireme, City Limits, Elixir, Brooklyn).
- Test accounts (test2, Fgth, Hgfhg) were left alone.

In the code: applied on 2026-11-15 to coffee-dial-buzink with one-off scripts (not in the repo): 67 coffeeTypes got name, 115 beans and 146 coffees (brews) got the matching farmer.
