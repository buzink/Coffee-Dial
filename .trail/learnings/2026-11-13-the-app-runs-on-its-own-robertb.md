---
title: "The app runs on its own Firebase project, cloned from the one shared with Tieme"
author: RobertB
date: 2026-11-13
branch: main
cost: { minutes: 24, tokens: 69455 }
id: l-2f933232
scope: repo
status: active
replaces: l-41b2699b
src: agent
touches:
  - src/config/firebase.js
  - src/config/firebase-session.js
---

## Decided
Tieme built a new app that writes to the original Firebase project, so Coffee Dial got its own project on Robert's Google account and billing. Database, users, photos, rules, indexes and the four functions still in use were cloned on 2026-11-13. The two AI functions were not, because AI now runs in the app.

## Tried and ruled out
Keeping the shared project and only adding the new site address to it: that leaves two apps writing to one database and billing on someone else's account.
The Firebase CLI for the clone: its stored login had expired. The REST APIs with a gcloud token did the job, and for deploys the CLI works with application-default credentials when given an empty config folder and the new project as quota project.

## Watch out
The clone is a snapshot. Anything entered in the old app after 2026-11-13 is not in the new project; repeat the database export/import and photo sync at the real switch-over.
User IDs were kept, so everyone's data stays linked. Google sign-in must be switched on by hand in the console; it cannot be enabled through the API without an OAuth client.
Push uses a new key pair. Devices must re-enable notifications, and the pair must be imported under Cloud Messaging web push certificates for the FCM path.
Photo links stored as full URLs were rewritten to the new bucket; download tokens survive a bucket-to-bucket copy.
A full database export still sits in the migration bucket.
In zsh, write ${N} before a colon in a URL: $N:addFirebase is read as a modifier.

In the code: src/config/firebase.js and src/config/firebase-session.js (both hold the config), WEB_PUSH_VAPID_KEY, MOMENTS_PUSH_LINK in the notifications function, cloud/firebase-config/cors.json. Projects: old coffee-dial-app-9db38, new coffee-dial-buzink. Bucket gs://coffee-dial-buzink-migration.
