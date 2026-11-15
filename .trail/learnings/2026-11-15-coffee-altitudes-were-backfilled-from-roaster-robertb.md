---
title: "Coffee altitudes were backfilled from roaster pages, and values were dropped when the lot or the sources were unclear"
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 1, tokens: 1915 }
id: l-cd602bc1
scope: repo
status: active
src: agent
touches:
  - src/core/altitude.js
---

## Decided
The altitudes of Robert's and Tieme's coffees were looked up on the web (four agents in parallel, about 25 coffees each) and written only into empty altitude fields: 48 of 101 coffees. A value was kept when it came from the roaster's own page for that coffee (live, archived, or seen through a search summary of that page), or from a reseller, listing site or decaffeinator page that clearly sells the same lot. Blends of several origins stay empty on purpose.

## Tried and ruled out
Taking a value from a roaster page that now sells another lot under the same name or URL (LOT61 Nosegrind went from blend to Ethiopia; The Picky Chemist reuses pages for new lots of the same farm), from sources that disagree (DAK Lemon Spritz 1900 vs 2100, two lots under one name), or only from a search summary of a third-party page (Friedhats Gasharu Impano via Algrano): all left empty.

## Watch out
Wakuli, Fortin, Kaldi and Zwarte Roes pages mostly give no altitude, and several shops (Eight Ounce, Kaldi, Fortin, Ditta, Sigma) rate-limit fetches with 429; web.archive.org cannot be read with WebFetch. A second run later may fill some of the 53 empty ones; Tieme's Bookkisa and DAK Lemon Spritz may be other lots than Robert's.

In the code: the altitude text format is what parseAltitude in src/core/altitude.js reads; written with .claude/skills/backfill-coffee-database/scripts/apply-fill.mjs (plan [{id, fields:{altitude}, price:null}], dry run first, --apply, then a dry run that must say would write=0).
