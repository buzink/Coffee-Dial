---
title: "The MCP server signs its own tokens instead of storing them, keyed from the Google client secret"
author: RobertB
date: 2026-11-25
branch: feature/mcp-server
cost: { minutes: 32, tokens: 791158 }
id: l-c1f063cb
scope: repo
status: active
src: agent
touches:
  - cloud/mcp-server/src/config.js
  - cloud/mcp-server/src/errors.js
  - cloud/mcp-server/src/store.js
  - cloud/mcp-server/src/tokens.js
  - cloud/mcp-server/src/identity.js
  - cloud/mcp-server/src/http-util.js
  - cloud/mcp-server/src/auth.js
  - cloud/mcp-server/src/oauth.js
  - cloud/mcp-server/src/validate.js
  - cloud/mcp-server/src/limits.js
---

## Decided
- Google has no dynamic client registration, so the MCP server is also the OAuth 2.1 authorization server. Client ids, authorization codes and tokens are HS256 JWTs signed with a key derived from GOOGLE_CLIENT_SECRET (HKDF). Nothing is stored, so any Cloud Run instance can verify them and no extra secret is needed.
- PKCE with S256 is required. Authorization codes live 60 seconds and are not single use; PKCE is what stops a stolen code from working.

In the code: cloud/mcp-server/src/tokens.js and src/oauth.js.
- The app keys its data by the Firebase Auth uid. The MCP server maps a Google sign-in to it in this order: a Firebase user linked to the Google account (provider google.com, uid = sub); a Firebase user with the same email, only if Firebase marks that email verified; otherwise the empty namespace google-<sub>.
- ALLOWED_EMAIL is optional. Empty: any account with a verified Google email gets its own environment, guarded by the write limits. Set: only that address. It is read from the environment (Secret Manager) and never written to code or logs.

In the code: cloud/mcp-server/src/identity.js, src/auth.js, src/limits.js.
- The tests that check no write leaves users/{uid} walk the emulator with listDocuments(), not collection.get(). A path check that uses get() misses everything under a user whose root document was never written.

In the code: cloud/mcp-server/test/paths.test.js (allDocPaths).
- Tool names, function names, validation names and tests are English (list_coffees, list_bags, get_analysis, upsert_coffee, upsert_bag). Firestore collection names are not renamed, because they are the app's existing data paths.

In the code: cloud/mcp-server/src/tools.js (tool names) and src/store.js (collection allowlist).
- The first deploy used gcloud run deploy from the feature branch, because the deploy workflow only runs from main. Flags match the workflow; ALLOWED_EMAIL comes from Secret Manager.

In the code: cloud/mcp-server/src/app.js (routes), .github/workflows/deploy-mcp-server.yml (deploy flags).

## Tried and ruled out
- Storing codes and tokens in Firestore. The brief keeps every path under users/{uid}, and a per-call read is not needed when the token is verified by signature.
- Using the Google sub as the uid: the data the web app stores would never be visible to the MCP server.
- Trusting any Firebase email: email/password sign-ups need no verification, so an unverified account could claim someone else's email.
- Walking with collection.get() plus listCollections() on each returned document. It reported no coffees for a user that only had subcollection data, so the isolation test passed for the wrong reason.
- Renaming the Firestore collections to English too. The web app reads them by these names, so that would need a data migration for no gain.
- Checking health at /healthz on the run.app URL. Google's front end returns its own 404 page, so the request never reaches the container. The container is healthy; /.well-known/oauth-protected-resource returns 200 on the same host.

## Watch out
- Tokens cannot be revoked one by one. Rotating GOOGLE_CLIENT_SECRET invalidates all of them. The allowlist is checked on every call, so blocking one account takes effect at its next call.
- A Google account with no Firebase user gets an empty namespace the web app never reads, so writes made through MCP are invisible in the app for that account.
- The runtime service account needs roles/firebaseauth.viewer, or every sign-in fails with a permission error.
- Defaults in the write path must fill only undefined keys. Object.assign(data, defaults, data) overwrote a caller's null or 0 with the default, so beanId, stock and notes were silently reset until the tests caught it. In the code: cloud/mcp-server/src/entities.js (withDefaults).
- Tool names are the interface Claude sees. A connector user who saved prompts with the old names (list_koffies, upsert_zak) must use the new ones; there is no alias, because the server has no users yet.
- Use /.well-known/oauth-protected-resource or /mcp to check a Cloud Run deploy. A failed check on /healthz does not mean the container is down.
- The service URL is https://coffee-dial-mcp-2jblv7qija-uc.a.run.app. The Google OAuth redirect URI must be exactly that host plus /oauth/callback.
