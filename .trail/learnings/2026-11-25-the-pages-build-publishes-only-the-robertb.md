---
title: "The Pages build publishes only the files it copies into dist, so the privacy policy needs its own copy step"
author: RobertB
date: 2026-11-25
branch: main
cost: { minutes: 2, tokens: 71055 }
id: l-effb5ef8
scope: repo
status: active
replaces: l-43f9ca06
src: agent
touches:
  - scripts/build.mjs
  - privacy.html
  - ".github/workflows/deploy.yml"
---

## Decided
GitHub Pages publishes dist/, not the repo root. scripts/build.mjs copies a fixed list of files into dist/, and a file that is not on that list is not served. privacy.html is now on the list.

In the code: scripts/build.mjs (copyIfExists list, which now includes privacy.html); .github/workflows/deploy.yml (uploads ./dist as the Pages artifact).

## Tried and ruled out
Assuming deploy.yml publishes the whole repo, which is what the earlier privacy-policy learning said. The page was missing from dist/, so the URL returned 404 even though the deploy step ran.

## Watch out
- Any new root-level file that must be public (privacy page, 404 page, verification files) needs its own copyIfExists line, or it will 404 on Pages.
- The Pages deploy for a commit can fail at the Pages step ("Deployment failed, try again later") while the build step is green. Check the deploy run, not just the build, before assuming a page is live.
