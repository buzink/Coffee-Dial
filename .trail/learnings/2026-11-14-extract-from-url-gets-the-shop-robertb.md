---
title: "Extract from URL gets the shop's photo in the browser for Shopify and through a Cloud Function for other shops"
author: RobertB
date: 2026-11-14
branch: main
cost: { minutes: 6, tokens: 66890 }
id: l-bb9212d6
scope: repo
status: active
src: agent
touches:
  - cloud/google-cloud-functions/fetchShopImage-function-source/package.json
  - cloud/google-cloud-functions/fetchShopImage-function-source/index.js
  - cloud/google-cloud-functions/fetchShopImage-function-source/index.test.js
  - src/core/page-image.js
  - src/features/ai-import/ai-import.js
---

## Decided
- Extract From URL now also fetches the product photo and treats it like a scanned one (compressed, background removed for new coffees and bags, uploaded). Order: the browser reads the page and photo itself (works for Shopify, which allows CORS); if that fails the callable Cloud Function fetchShopImage does it on the server; if that fails too, the coffee is added without a photo, as before.
- The photo is found as og:image, twitter:image, link rel=image_src, the schema.org Product image in JSON-LD, then the WooCommerce data-large_image (the Manhattan WordPress shop has only the last two). The browser (src/core/page-image.js) and the function use the same order.
- The function is a Firebase callable like getPhotoSignedUrl: signed-in users only, refuses private/internal addresses at every redirect hop, max 4 redirects, 10 s per request, 3 MB pages and 6 MB images. It deploys from GitHub on push to main (deploy-fetch-shop-image.yml).

## Tried and ruled out
- Fetching Shopify pages from the function: Shopify answers 429 to Node's fetch while curl and browsers get the page. Not worked around on purpose; Shopify is covered by the browser path.

## Watch out
- The function has not run in Google Cloud yet; it was tested locally against live shops (WordPress photo found, metadata IP and localhost refused).
- DNS is checked before each request but resolved again by fetch, so a rebinding attack has a small window; the function only returns images, which limits what could leak.

In the code: cloud/google-cloud-functions/fetchShopImage-function-source (index.js, index.test.js), src/core/page-image.js, fromUrl and compressPagePhoto in src/features/ai-import/ai-import.js.
