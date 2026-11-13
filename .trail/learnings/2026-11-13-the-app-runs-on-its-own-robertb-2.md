---
title: "The app runs on its own Firebase project, cloned from the one shared with Tieme"
author: RobertB
date: 2026-11-13
branch: main
cost: { minutes: 1, tokens: 950 }
id: l-e5c1dac7
scope: repo
status: active
replaces: l-2f933232
src: agent
touches:
  - src/config/firebase.js
  - src/config/firebase-session.js
---

## Decided
Tieme built a second app that writes to the original Firebase project, so Coffee Dial got its own project on Robert's Google account and billing. Database, users, photos, rules, indexes and the four functions still in use were cloned on 2026-11-13; Robert confirmed the data and no second export was needed. The old project was put back as it was and belongs to Tieme's app.

## Tried and ruled out
Keeping the shared project and only adding the new site address to it: two apps on one database, and billing on someone else's account.
Deploying this repo's rules file to the old project: it replaced the whole rule set and dropped a rule Tieme had added by hand for his app (simpleRecipes), which broke it until the previous set was restored.

## Watch out
The rules file here is the source for the new project only. Never deploy it to the old one.
User IDs were kept in the clone. Google sign-in had to be switched on by hand in the console.
Push uses a new key pair, imported under Cloud Messaging web push certificates; devices must re-enable notifications.
The Firebase CLI login had expired: it works with application-default credentials when given an empty config folder and the new project as quota project.

In the code: src/config/firebase.js and src/config/firebase-session.js (both hold the config), cloud/firebase-config/firebase-firestore.rules. Projects: old coffee-dial-app-9db38, new coffee-dial-buzink.
