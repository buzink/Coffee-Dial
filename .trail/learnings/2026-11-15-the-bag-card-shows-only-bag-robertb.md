---
title: "The bag card shows only bag dates beside its photos, in one column"
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 2, tokens: 71964 }
id: l-33fa046c
scope: repo
status: active
src: agent
touches:
  - src/features/beans/beans-card-ui.js
  - src/features/beans/beans-card.view.html
---

## Decided
The bag card no longer repeats the coffee's origin, process, variety and roast; those live on the coffee card. The bag's own dates (roast, frozen, opened, finished) take that top-left spot, with the round bean photo directly left of the coffee photo, bottoms aligned.

## Tried and ruled out
Two columns of dates: next to both photos there is only ~110px on a phone, so dates like "14 Nov 2026" wrapped over two lines. One column fits about the height of the coffee photo.

## Watch out
If you add a field to this block, check the phone width (375px); there is no room for a second column.

In the code: src/features/beans/beans-card.view.html (beanCardView top row: grid-cols-1 dates, beanCardBeanImageSection, beanCardImageSection, flex items-end).
