---
title: "A coffee's photo can be taken from a Shopify shop page in the browser, but not from most other shops"
author: RobertB
date: 2026-11-14
branch: main
cost: { minutes: 6, tokens: 17135 }
id: l-5a3d48b8
scope: repo
status: active
src: agent
---

## Decided
- Research only (14 Nov 2026), nothing built yet. For Extract From URL the photo can come from the page's og:image, downloaded by the browser and uploaded like a scanned photo.

## Tried and ruled out
- Relying on the browser for every shop: Shopify shops (Square Mile, Coffee Collective, La Cabra, Friedhats) send access-control-allow-origin: * for their pages, /products/<handle>.json and /cdn/shop/ images, so fetch works from the app. A WordPress/WooCommerce shop (Manhattan) sends no CORS header, so the browser blocks the image download ("Failed to fetch").
- Gemini's url_context tool returns text only; whether the image address is in what it reads is unverified (no real key in test mode).

## Watch out
- Full coverage needs a server: a small Cloud Function that fetches the page or image server-side (the repo already deploys functions from GitHub, see cloud/google-cloud-functions).
- An <img> can show a foreign image without CORS, so storing the shop's image URL as imageUrl works for display, but breaks when the shop changes the file and cannot go through background removal.
