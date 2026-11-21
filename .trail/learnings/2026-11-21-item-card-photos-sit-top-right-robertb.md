---
title: "Item card photos sit top right, level with the first property label, and the roaster stays in the card head"
author: RobertB
date: 2026-11-21
branch: main
cost: { minutes: 1, tokens: 13108 }
id: l-89c43ab6
scope: repo
status: active
src: agent
touches:
  - src/styles/app.css
---

## Decided
The user wanted the photo on brew, bag, coffee and gear cards in the top right of the card body, its top level with the first property: Drink on the brew card, Origin country on the coffee card, Roast on the bag card, Type on the gear card. Properties that sat in the top right moved below the others (gear: Price now comes after Methods, in one column). The bag card's round bean photo sits on its own below the price/weight/beans left/status row.

## Tried and ruled out
Moving the roaster (subtitle) and rating from the card head into the body, so the photo could start level with the roaster: the user wanted the roaster to stay as the subtitle in the head, the same on brew, bag and coffee cards.
The bean photo below the last date (Finished), left of the coffee photo: the user wanted it below the price/weight row.

## Watch out
The photo boxes are 3:4 and photos are object-contain, so a square photo was centred lower than the box top; .app-card-top > :last-child img gets object-position: top, plus a small margin-top so the photo meets the label text, not its line box (0.3rem for 10px labels on 20px lines, 0.15rem on the brew card whose labels are 12px on 16px).

In the code: src/styles/app.css (.app-card-top), the four *-card.view.html files.
