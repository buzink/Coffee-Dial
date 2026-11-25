---
title: "The public privacy policy for Google OAuth branding is a static page on GitHub Pages, not in the app"
author: RobertB
date: 2026-11-25
branch: feature/mcp-server
cost: { minutes: 1, tokens: 1486 }
id: l-43f9ca06
scope: repo
status: active
src: agent
---

## Decided
The privacy policy for the Google OAuth consent screen is a static page, privacy.html in the repo root, served by GitHub Pages at buzink.github.io/Coffee-Dial/privacy.html. It is kept out of the app and the service worker, because it only has to be public for Google's branding review.

In the code: privacy.html (repo root); deploy.yml publishes the whole repo to Pages on push to main.

## Tried and ruled out
Hosting it as a Claude artifact: artifacts need a login, and Google's review needs a public URL without sign-in, so the review would fail.

## Watch out
- The contact address is still a placeholder ([CONTACT EMAIL ADDRESS]) and must be filled in before the review, because Google rejects a policy without a working contact.
- Google expects the privacy and homepage URLs on a domain verified in Search Console. A github.io address usually cannot be verified, so a custom domain may be needed.
- The Pages deploy after a push to main can sit in "waiting" (GitHub environment protection), so the URL may not be live right after the push.
- The feature branch had uncommitted work, so the page was committed through a temporary worktree from origin/main to keep that work out of main.
