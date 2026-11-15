---
title: "Moments is a page like Bags and Statistics, with a Friends/Mine switch on the page instead of tabs in a header"
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 4, tokens: 52271 }
id: l-6e805bb4
scope: repo
status: active
src: agent
touches:
  - index.html
  - src/features/gallery/gallery.view.html
  - src/features/gallery/gallery.js
  - src/app/pages.js
  - src/app/composition/app-composition.js
  - src/styles/app.css
---

## Decided
- Moments stopped being a modal. It sits inside <main>, carries data-app-page="moments" (route key moments, in PAGE_ROUTE_KEYS) and replaces the brews view like the other pages. It is in the desktop header navigation and has a mobile header title.
- The element keeps its old id galleryModal, so openGallery, hideGalleryModal, the route map and the badge code needed no changes.
- Friends' or my moments is chosen with an iOS-style segmented control (Friends / Mine) in the page head; switchGalleryTab only sets aria-selected and app.css styles the selected side. The red dots for new comments stay inside the buttons.
- Escape no longer closes Moments, like the other pages.
- Dialog titles for Preferences, Import & export, Help ("How to use") and About ("About") sit in the icon row between back and close (h3.app-sheet-type); other dialogs keep their large title below.

## Watch out
- index.html and shell.view.html each hold a copy of the header: a nav item or header title has to go in both.

In the code: src/features/gallery/gallery.view.html, switchGalleryTab in src/features/gallery/gallery.js, src/app/pages.js, pageOpenActions/pageCloseActions in src/app/composition/app-composition.js, .app-segmented in src/styles/app.css.
