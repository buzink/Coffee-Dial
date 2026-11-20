---
title: On phones the main menu is a drawer from the left that pushes the whole page to the right
author: RobertB
date: 2026-11-20
branch: main
cost: { minutes: 5, tokens: 125671 }
id: l-4637d989
scope: repo
status: active
src: agent
touches:
  - src/features/ui-shell/ui-shell.js
  - src/styles/app.css
  - index.html
  - src/features/shell/shell.view.html
---

## Decided
The user wanted the main menu bigger, with larger text, and on phones a drawer that slides in from the left while the rest of the app slides right (like the Claude iOS app's sidebar). Desktop keeps the dropdown under the menu button, just wider (16rem) with 16px items.

## Watch out
- The drawer stays inside the fixed header and sits just left of it (translateX(-100%)). A transform on the header makes it the containing block for the fixed drawer, so shifting the header by the drawer width brings the drawer into view; main, the bottom bar and the add button get the same shift. Moving the drawer out of the header would break the desktop dropdown positioning.
- app.css forces .hidden to display:none !important, so the drawer needs display:flex !important on #mainMenuDropdown.hidden to stay rendered for the slide; visibility hides it after the 0.3s transition.
- The dim layer is body::after (z 59, under the header's z 60); tapping it hits body, which the existing outside-click handler uses to close the menu.

In the code: setMainMenuOpen in src/features/ui-shell/ui-shell.js toggles html.main-menu-open; styles in the max-width 639px block of src/styles/app.css (--app-menu-width: min(82vw, 22rem)); the "Coffee Dial" title (.app-menu-title) is in both header copies, index.html and src/features/shell/shell.view.html.
