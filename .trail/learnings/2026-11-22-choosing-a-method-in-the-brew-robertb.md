---
title: "Choosing a method in the brew form fills in a matching drink, but only while the drink is still empty"
author: RobertB
date: 2026-11-22
branch: main
cost: { minutes: 1, tokens: 61677 }
id: l-96d943fd
scope: repo
status: active
src: agent
touches:
  - src/features/brews/brew-form-actions.js
---

## Decided
The user wanted the Add brew form to pick a drink that fits the method: Espresso gives Flat White; V60, Hario Switch, Clever Dripper, Aeropress, French Press and Chemex give Filter Coffee; OXO Rapid Brewer gives Soup americano. A drink the user already chose is never overwritten, and Other or an unmapped method leaves Drink alone.

## Watch out
The Add and Edit brew forms share this code, so editing a brew without a drink also gets the default. Quick Edit Brew has its own method/drink code and was not changed. The drink values must match the option values exactly ("Flat White", "Filter Coffee", "Soup americano").

In the code: DEFAULT_DRINK_BY_METHOD and applyDefaultDrinkForMethod in src/features/brews/brew-form-actions.js, called from toggleMethodOther (the method select's change action).
