---
title: "The statistics origins map is a pre-projected SVG of country outlines, with no map library in the app"
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 17, tokens: 38035 }
id: l-1cd00d47
scope: repo
status: active
src: agent
touches:
  - src/app/card-routing.js
  - tests/playwright/card-page-navigation.spec.js
  - src/app/composition/action-assemblies.js
  - src/app/composition/app-composition.js
  - src/features/social/social.module.js
  - src/features/stats/stats.js
  - src/features/stats/stats.view.html
  - src/styles/app.css
  - src/features/stats/stats-origins-map.js
---

## Decided
The Origins card on Statistics draws a world map from country outlines that were projected once (Natural Earth 1:110m, public domain, via the world-atlas package, Natural Earth 1 projection) and saved as SVG path strings. The app loads no map or geo library; the data (~80 KB) loads with the statistics module only.
Countries are shaded in four levels by how many different coffees came from them in the brews shown, so the map follows the My/Friends and period filters. Tap or hover shows coffees and brews for a country; chips below list the countries and any origin that could not be placed.
Origin text is matched to map country names directly, through Dutch names and growing regions (Sumatra → Indonesia, Yunnan → China, Hawaii → USA), and blends like "Brazil, Colombia" count for each country.

## Tried and ruled out
Chart.js geo plugin or d3 in the app: an extra library and a topojson download for one card.

## Watch out
The 1:110m data leaves out very small countries and islands (e.g. Réunion, St Helena); those origins land under "Not on the map". To add them, regenerate from countries-50m (about 750 KB raw, so simplify) instead of hand-editing the data file.

In the code: src/features/stats/world-map.data.js (generated: topojson-client feature() + d3-geo geoNaturalEarth1().fitExtent to 960x470, geoPath digits(0), Antarctica dropped); originCountries and ALIASES in src/features/stats/stats-origins-map.js; .origins-map rules in src/styles/app.css.
