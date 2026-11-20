---
title: "Everything you tap in the app is at least 44 px, done with app-wide CSS and invisible tap areas"
author: RobertB
date: 2026-11-20
branch: main
cost: { minutes: 28, tokens: 87933 }
id: l-d1a38459
scope: repo
status: active
replaces: l-547ad44d
src: agent
touches:
  - src/styles/app.css
---

## Decided
The user wanted the app easier to use on a phone, so every control is now at least 44x44 px at every width:
- All inputs, selects, textareas and multi-select boxes have a minimum height of 44 px.
- Labels sit 4 px above their field. The user asked for 4 px, not 8.
- Cancel/Save buttons under edit forms and dialogs are 44 px high.
- Small buttons that should keep their look have an invisible 44x44 px tap area around them, made with a positioned ::after. This applies to switches, the edit pencils, Text/SCA Wheel, View wheel and the x on gear chips. Rating stars are 44x44 boxes.
- In the brew form, the Auto/Swirls/Pours rows are labels, so tapping the row text flips the switch.

## Tried and ruled out
- Making the switches themselves bigger or turning every settings row into a label: CSS on the switch track is enough and changes no markup.

## Watch out
- An element inside a space-y-* parent gets its margin from Tailwind with higher specificity, which is why the 4 px label rule has a second rule with a doubled attribute selector.
- A switch next to long text was squeezed below 44 px wide by flex. Its wrapper now has flex-shrink 0.
- A new small button needs its own ::after tap area. Only inputs, selects and the Cancel/Save rows are covered by general rules.

In the code: src/styles/app.css after `.temp-step-btn` (input min-height, label margin, `.justify-end > button.py-1\.5`, ::after tap areas) and next to `.toggle-checkbox` (`.toggle-label` padding with negative margin and background-clip, `:has(> .toggle-checkbox) { flex-shrink: 0 }`).
