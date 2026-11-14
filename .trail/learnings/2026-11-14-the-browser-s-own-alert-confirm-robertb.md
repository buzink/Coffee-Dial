---
title: "The browser's own alert, confirm and prompt do not work in this app; use the app dialogs"
author: RobertB
date: 2026-11-14
branch: main
cost: { minutes: 1, tokens: 13963 }
id: l-d2393904
scope: repo
status: active
src: agent
touches:
  - src/core/confirm.js
  - src/core/overlay-host.view.html
---

## Decided
- At startup the app replaces window.alert with a toast, window.confirm with "always no" and window.prompt with "always nothing". Code that needs an answer uses openAppConfirm, or openAppPrompt for a line of text (the same dialog with an input field).

## Tried and ruled out
- window.prompt for the Extract From URL address: it silently returned null, so clicking From URL did nothing. A test that stubs window.prompt hides this; drive the real dialog instead.

In the code: installDialogAdapters, openAppConfirm and openAppPrompt in src/core/confirm.js; #appConfirmInput in src/core/overlay-host.view.html.
