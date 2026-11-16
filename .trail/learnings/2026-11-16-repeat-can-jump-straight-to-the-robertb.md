---
title: "Repeat can jump straight to the brew graph, and Bluetooth connect only works from a real click"
author: RobertB
date: 2026-11-16
branch: main
cost: { minutes: 4, tokens: 62192 }
id: l-512655fd
scope: repo
status: active
src: agent
touches:
  - src/app/pwa.js
  - src/features/devices/devices-modals.js
  - sw.js
  - src/features/brews/brews-actions.js
  - src/app/composition/app-composition.js
  - src/features/preferences/preferences.js
---

## Decided
The preference "Jump to graph after repeat" (off by default) opens the graph right after the Repeat brew form is shown, for your own and a friend's brew. It calls the same graph-open step as the graph button, so Connect Devices and the scale 1 chooser follow only when the graph is empty and nothing is connected. Fast repeat saves without a form and is not affected.

## Tried and ruled out
Testing the chain with scripted clicks (element.click() from page JavaScript): requestDevice then fails with SecurityError "Must be handling a user gesture". That is the test, not the code. Real clicks in the browser pane (click by ref) reach the chooser, which the pane then cancels itself (NotFoundError "User cancelled").

## Watch out
In the local preview, unregistering the service worker was not enough: the browser's HTTP cache still served an old app-composition.js, so the new wiring seemed to do nothing. Fetch the changed files with cache: 'reload' (or hard-reload) before concluding a change does not work. Test mode ?e2eSeed=1 runs the app without signing in; preferences toggled there only last until reload.

In the code: jumpToGraphAfterRepeat in src/features/brews/brews-actions.js (called after presentPreparedForm in showDuplicateInForm and showFriendRepeatInForm); openGraphModal passed in through actionsDeps in src/app/composition/app-composition.js; pref jumpToGraphAfterRepeat in src/features/preferences/preferences.js and toggle jumpToGraphAfterRepeatToggle in preferences.view.html.
