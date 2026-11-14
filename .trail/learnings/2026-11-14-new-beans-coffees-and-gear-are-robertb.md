---
title: "New beans, coffees and gear are drafts until Save, so Add never writes an empty item"
author: RobertB
date: 2026-11-14
branch: main
cost: { minutes: 8, tokens: 130825 }
id: l-2c95ffb5
scope: repo
status: active
src: agent
touches:
  - src/core/draft-items.js
  - src/styles/app.css
---

## Decided
- Add on the beans, coffees and gear pages used to write an empty document straight away and then open its card for editing. Now the new item is a draft: it gets the id its document will have (a 20-character Firestore-style id) and an isDraft flag, lives only in the local list, and is written with that id when the card's Save is clicked. Discard (the Cancel button) or closing the card removes it.
- While a draft is open the card shows "Add bean/coffee/gear" with a plus icon, Discard and "Save bean/coffee/gear", like the Add brew form. This is a data-adding attribute on the card overlay, styled in the app stylesheet.
- Drafts are kept out of the page tables, card prev/next order, bean maintenance and the home snapshot.

## Tried and ruled out
- Discarding the draft inside the bean card's cancel function: opening a bean card calls that same function to reset the card to view mode, so the draft was discarded the moment its card opened. The UI reset is now separate (resetBeanEditMode) from the Cancel/Discard button (cancelBeanEditMode).
- Opening the new coffee with openCard and then entering edit mode: the card mounts lazily, so edit mode ran before the card existed. It now uses the coffees.openCardForEdit command, which waits for the mount.

## Watch out
- In test mode (?e2eSeed=1) Save fails with permission-denied, so only the absence of writes on Add and the write attempt on Save can be checked there.
- When previewing on the local Python server, ES modules can stay cached after a service-worker reset; check that the running function holds the new code before trusting a test.

In the code: src/core/draft-items.js; createBeanFromModal (beans-actions.js), createCoffeeTypeFromModal (coffees.coordinator.js), createGasItemFromModal (gas.coordinator.js); saves in beans-card-form.js, coffee-type-card.js, gas-card.js; .app-card-add-title / .app-when-adding in app.css.
