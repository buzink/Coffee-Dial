---
title: "Bean-o-meter shows every period in the chosen range, empty ones too, and labels from the first bar: every bar under 8 bars, else every 7th"
author: RobertB
date: 2026-11-15
branch: main
cost: { minutes: 1, tokens: 12285 }
id: l-b14aa200
scope: repo
status: active
replaces: l-92f4003a
src: agent
touches:
  - src/features/stats/stats.js
---

## Decided
Day, week, month and year views fill every period from the start of the statistics date filter (or the first brew for All time) through the current period, with empty periods as 0. Weeks are labelled as ISO year-week ("2026-46", the year of the week's Thursday). The first bar always gets a label; after that every bar when fewer than 8 are shown, otherwise every 7th (so not tied to Mondays). Dates in the day view are always slanted at 45 degrees; other labels only slant when they do not fit. A short tick line runs from each label up to its bar. All buckets use local dates, not UTC, so late-night brews land in the right day and week.

## Tried and ruled out
Choosing the tick line colour per tick with a scriptable grid colour: the index Chart.js passes does not match the label index once labels are hidden. Instead the tick callback returns null for unlabelled bars, which makes Chart.js skip that tick's line, and the grid uses one fixed colour.

## Watch out
Chart.js only rotates labels when they do not fit, and it measures only the labels the callback returns, so with every 7th label the dates lay flat; the day view needs minRotation. grid.offset must be false for the tick to sit under the bar. Changing the statistics period resets the Bean-o-meter to Day (calculateStats calls updateBeanMeter('day')). The app needs a Google sign-in, so the chart is tested by importing createStatsModule in the browser with a stub dataService and fake brews; use the Chart from ensureChartJs() to read the chart back.

In the code: updateBeanMeterInternal (bucketStart, bucketKey, isoWeekLabel, showsLabel), getPeriodStart, toLocalDayKey, parseLocalDayKey in src/features/stats/stats.js.
