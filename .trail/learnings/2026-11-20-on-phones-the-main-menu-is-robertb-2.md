---
title: On phones the main menu is a drawer from the left that pushes the whole page to the right
author: RobertB
date: 2026-11-20
branch: main
cost: { minutes: 5, tokens: 47643 }
id: l-3854d5df
scope: repo
status: active
replaces: l-4637d989
src: agent
touches:
  - index.html
  - src/app/pwa.js
  - src/features/shell/shell.view.html
  - src/features/ui-shell/ui-shell.js
  - src/styles/app.css
  - sw.js
---

## Decided
The user wanted the main menu bigger, with larger text, and on phones a drawer that slides in from the left while the rest of the app slides right (like the Claude iOS app's sidebar). Desktop keeps the dropdown under the menu button, just wider (16rem) with 16px items.
After tapping a menu item the drawer must slide back at the same speed it came in. Page items (Brews, Bags, ...) switch the page at once and the drawer slides away over it. Dialog items (Import & export, Preferences, Help, About) carry data-menu-dialog: on phones the drawer closes first and the dialog opens 300 ms later, because a full-screen dialog would otherwise cover the drawer instantly and the close looks abrupt.

## Watch out
- The drawer stays inside the fixed header and sits just left of it (translateX(-100%)). A transform on the header makes it the containing block for the fixed drawer, so shifting the header by the drawer width brings the drawer into view; main, the bottom bar and the add button get the same shift. Moving the drawer out of the header would break the desktop dropdown positioning.
- app.css forces .hidden to display:none !important, so the drawer needs display:flex !important on #mainMenuDropdown.hidden to stay rendered for the slide; visibility hides it after the 0.3s transition.
- The dim layer is body::after (z 59, under the header's z 60); tapping it hits body, which the existing outside-click handler uses to close the menu.
- toggleMainMenu(null), which every menu item calls after its action, only closes. The delayed dialog path re-clicks the item after the drawer has closed, and a toggle there would reopen the menu.
- In the local preview an old service worker kept serving the old ui-shell.js while the HTML was new; unregister it and clear caches before testing.

In the code: setMainMenuOpen, toggleMainMenu and delayMenuDialogUntilDrawerClosed in src/features/ui-shell/ui-shell.js (html.main-menu-open, capture click listener added in initGlobalCloseHandlers); styles in the max-width 639px block of src/styles/app.css (--app-menu-width: min(82vw, 22rem)); the "Coffee Dial" title and data-menu-dialog are in both header copies, index.html and src/features/shell/shell.view.html.
