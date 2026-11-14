---
title: "While a card is being edited its header says Edit or Add with the type's icon, decided by CSS alone"
author: RobertB
date: 2026-11-14
branch: main
cost: { minutes: 2, tokens: 33326 }
id: l-3f6ede55
scope: repo
status: active
src: agent
touches:
  - src/styles/app.css
  - src/features/brews/brews-actions.js
---

## Decided
- Brew, bean, coffee and gear cards show "Edit <type>" (or "Add <type>" for an unsaved new item) with the type's icon instead of the item's name while their edit section is open. This is pure CSS: the overlay has class app-card, the edit section app-card-edit, and `.app-card:has(.app-card-edit:not(.hidden))` swaps the name block for the mode title. No edit function has to set anything, so a new way into edit mode needs no extra code.
- Add vs Edit text still comes from the data-adding attribute set for drafts.

## Watch out
- The brew form's header only changes when openBrewFormModal gets a title; editing a brew showed "Add brew" until editCoffee passed title 'Edit brew'.

In the code: .app-card-mode-title rules in src/styles/app.css; mode titles in the four *-card.view.html files; editCoffee in src/features/brews/brews-actions.js.
