---
title: "The generated Tailwind stylesheet is out of date with the sources, so new styles go in the app stylesheet"
author: RobertB
date: 2026-11-14
branch: main
cost: { minutes: 3, tokens: 34735 }
id: l-0b1d51d2
scope: repo
status: active
src: agent
touches:
  - src/app/card-routing.js
  - src/app/composition/app-composition.js
  - tests/playwright/card-page-navigation.spec.js
  - src/app/header-nav.js
  - vendor/css/tailwind.generated.min.css
  - src/styles/app.css
---

## Decided
For the header navigation, new styles were written as plain CSS in the app stylesheet, and only Tailwind classes already present in the generated file were used.

## Tried and ruled out
Rebuilding the Tailwind stylesheet: it was already out of step with the sources, so the rebuild added and removed many unrelated rules (for example dark:flex disappeared). That belongs in its own change, checked across the app.

## Watch out
A Tailwind class that is not in the generated file does nothing until the stylesheet is rebuilt. Check with grep before using a new class.

In the code: vendor/css/tailwind.generated.min.css (built by npm run build:css:tailwind), src/styles/app.css (.app-header-nav rules).
