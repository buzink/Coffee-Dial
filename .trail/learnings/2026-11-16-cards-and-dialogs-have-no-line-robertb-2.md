---
title: Cards and dialogs have no line under their headings or above their footers
author: RobertB
date: 2026-11-16
branch: main
cost: { minutes: 1, tokens: 10557 }
id: l-ec166359
scope: repo
status: active
replaces: l-cceec199
src: agent
touches:
  - src/styles/app.css
  - src/features/brews/brews-form-modal.view.html
  - src/features/social/social.view.html
  - src/features/preferences/preferences.view.html
---

## Decided
The user wanted no lines under the headings and no lines above the footers of any card or modal, because the lines made the sheets look busy next to the calm brew graph modal and Add brew form. That covers the sheet's title row, section headings inside cards and dialogs (Statistics cards, Social sections, ratio calculator, pinned-brew chooser, emoji picker), the edit/save footers of brew, bag, coffee and gear cards, the brew card's bottom bar, the brew form modal footer, the Social footer and the build-info footnote in Preferences.
Kept on purpose, because they are not under a heading or above a footer: the line in the confirm dialog (it separates the message from the buttons), lines in tables, mobile accordion rows and filter dropdowns (not cards or modals), the In/Ratio/Out divider inside brew stats, and the divider under the emoji search field.

## Watch out
- The sheet heads still carry Tailwind border-b classes in their markup; app.css overrides them with border-bottom: 0 !important on .app-sheet-head. Removing that rule brings the lines back, because the markup classes still draw them.
- Footer lines were removed in the markup itself (border-t classes), so a new card or dialog copied from an old snippet can bring them back; don't add border-t above a footer, otherwise it breaks the look the user asked for.

In the code: .app-sheet-head in src/styles/app.css; footers (bg-coffee-50 ... px-4 pb-4, #cardBottomBar) in the brews/beans/coffee-type/gas card views; src/features/brews/brews-form-modal.view.html; src/features/social/social.view.html; src/features/preferences/preferences.view.html; heading lines in stats.view.html, social.view.html, brews-form.view.html, brew-pin-art.view.html and the reaction picker in gallery.js.
