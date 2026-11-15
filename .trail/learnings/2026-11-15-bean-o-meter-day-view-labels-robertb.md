---
title: "Bean-o-meter day view labels only Mondays and shows empty days, with tick lines drawn by hiding the other labels"
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 1, tokens: 1402 }
id: l-92f4003a
scope: repo
status: active
src: agent
touches:
  - src/features/stats/stats.js
  - vendor/js/chart.js
---

## Decided
The Bean-o-meter's day view is meant to show every calendar day from the first brew to today (days without brews as 0), with a date only under Mondays and a short white (dark) or black (light) tick line from that date up to its bar. Day keys use the local date, not UTC, so late-night brews land on the right day.

## Tried and ruled out
Choosing the tick line colour per tick with a scriptable grid colour (context.index == Monday): only one line showed, because the index Chart.js passes does not match the label index once labels are hidden. Instead the tick callback returns null for non-Mondays, which makes Chart.js skip that tick's grid line, and the grid uses one fixed colour.

## Watch out
Bar charts put grid lines between bars by default; grid.offset must be false for the tick to sit under the bar. The app needs a Google sign-in, so the chart can be tested by importing createStatsModule in the browser with a stub dataService and fake brews on a #chartBeanMeter canvas.

In the code: updateBeanMeterInternal, toLocalDayKey, parseLocalDayKey in src/features/stats/stats.js; Chart.js v4.5.1 from vendor/js/chart.js.
