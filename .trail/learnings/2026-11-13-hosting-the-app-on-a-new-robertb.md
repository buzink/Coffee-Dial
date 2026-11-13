---
title: Hosting the app on a new address needs that address added in Firebase login and in the photo storage
author: RobertB
date: 2026-11-13
branch: main
cost: { minutes: 10, tokens: 24755 }
id: l-41b2699b
scope: repo
status: active
src: agent
touches:
  - src/app/composition/app-composition.js
  - src/app/pwa.js
  - src/config/firebase.js
  - src/core/ai-settings.js
  - src/core/gemini-client.js
  - src/features/ai-import/ai-import.js
  - src/features/preferences/preferences.js
  - src/features/preferences/preferences.view.html
  - src/features/stats/stats-ai-profile.js
  - sw.js
---

## Decided
The app is moving from Tieme's GitHub account to Robert's, so its address changes. The Firebase project itself stays; only the allowed addresses change. The new address was added next to the old one on 2026-11-13, so both sites work during the move.

## Watch out
Two places in Firebase list the allowed addresses, and neither is deployed from the repo: the authorized domains of Firebase Authentication (sign-in fails without it) and the CORS setting of the storage bucket (photos fail without it).
The deploy of the cloud functions is tied to the old repository name through workload identity federation, and its GitHub secrets cannot be read back.
Billing for the project still runs through a billing account Robert has no access to.
The old address is also hardcoded in the page's canonical link and in the link used by push notifications.

In the code: cloud/firebase-config/cors.json (gitignored; apply with gcloud storage buckets update --cors-file), cloud/firebase-config/gcloud-config.md (GITHUB_REPO), index.html canonical link, MOMENTS_PUSH_LINK in cloud/google-cloud-functions/notifications-function-source/index.js. Project: coffee-dial-app-9db38. New address: buzink.github.io.
