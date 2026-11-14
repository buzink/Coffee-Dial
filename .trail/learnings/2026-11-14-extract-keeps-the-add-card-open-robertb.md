---
title: "Extract keeps the Add card open with a spinner, and live list updates keep unsaved drafts"
author: RobertB
date: 2026-11-14
branch: main
cost: { minutes: 3, tokens: 37734 }
id: l-c483939a
scope: repo
status: active
src: agent
touches:
  - ".github/workflows/README.md"
  - ".github/workflows/deploy-fetch-shop-image.yml"
  - ".github/workflows/lint-fetch-shop-image.yml"
  - cloud/google-cloud-functions/README.md
  - cloud/google-cloud-functions/fetchShopImage-function-source/.eslintrc.js
  - cloud/google-cloud-functions/fetchShopImage-function-source/.gcloudignore
  - cloud/google-cloud-functions/fetchShopImage-function-source/.gitignore
  - cloud/google-cloud-functions/fetchShopImage-function-source/index.js
  - cloud/google-cloud-functions/fetchShopImage-function-source/index.test.js
  - cloud/google-cloud-functions/fetchShopImage-function-source/package-lock.json
---

## Decided
- Choosing Take Photo, From Gallery or From URL on the Add bag or Add coffee card no longer closes the card. A spinner covers the card while the AI works; on success the draft card is discarded and the new bag or coffee opens in edit mode; on failure, or when the file picker is cancelled, the Add card simply stays.
- The live Firestore listeners replace whole bean, coffee and gear lists. They now keep an open draft (isDraft) that the new list does not contain, so a change from another device or from Extract no longer removes an unsaved new item. An empty list (sign-out, view reset) still drops it.

In the code: showCardBusy and isAddCardOpen in src/features/ai-import/ai-import.js; #beanCardBusy and #coffeeTypeCardBusy (.app-card-busy) in the card views and app.css; keepDrafts in src/app/composition/app-composition.js.
