# Scripts

## Authentication (all scripts)

Use Application Default Credentials (ADC):

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project coffee-dial-buzink
gcloud config set project coffee-dial-buzink
```

## Shared conventions

- All migration/backfill scripts run in `dry-run` mode by default.
- Add `--apply` to write changes.
- Optional common flags:
  - `--project coffee-dial-buzink`
  - `--uid <USER_UID>`
  - `--limit-users <N>`

## 1) Backfill photo paths

Populates `photoPath` / `thumbPath` in `users/{uid}/photos` from legacy `photoURL` / `thumbURL`.

- Script: `scripts/backfill-photo-paths.mjs`
- Dry run: `npm run backfill:photo-paths:dry`
- Apply: `npm run backfill:photo-paths:apply`

## 2) Keep each field in one place

Coffee details live only on the coffee (`coffeeTypes`), bag details on the bag (`beans`, linked by `coffeeTypeId`), brew details on the brew (`coffees`, linked by `beanId` and `gearIds`). Turns a typed grinder into a grinder gear link, gives bags and brews without a coffee one (with a finished bag for orphan brews), and deletes the copied fields from brews and bags. The dry run lists values that differ from the coffee and are dropped.

- Script: `scripts/migrate-single-source-fields.mjs`
- Dry run: `npm run migrate:single-source-fields:dry`
- Apply: `npm run migrate:single-source-fields:apply`

## 3) Backfill bean dates from brews

Backfills `openedDate` and `archivedDate` for beans from brew timestamps.

- Script: `scripts/backfill-bean-dates-from-brews.mjs`
- Dry run: `npm run backfill:bean-dates-from-brews:dry`
- Apply: `npm run backfill:bean-dates-from-brews:apply`

## 4) Backfill coffee type decaf flag

Sets `coffeeTypes.decaf = true` when decaf is detected in linked data.

- Script: `scripts/backfill-coffee-type-decaf-from-scan.mjs`
- Dry run: `npm run backfill:coffee-type-decaf:dry`
- Apply: `npm run backfill:coffee-type-decaf:apply`

## 5) Migrate missing beansLeft

One-time backfill for beans with `stock` set but missing `beansLeft`.

- Script: `scripts/maybe-migrate-beans-left.mjs`
- Dry run: `npm run backfill:beans-left-missing:dry`
- Apply: `npm run backfill:beans-left-missing:apply`

## 6) Recalculate all beansLeft

Recomputes `beansLeft` for all beans from current brew usage.

- Script: `scripts/recalculate-all-beans-left.mjs`
- Dry run: `npm run backfill:beans-left-recalculate:dry`
- Apply: `npm run backfill:beans-left-recalculate:apply`

## 7) Backfill public profiles from users

Creates/updates `publicProfiles/{uid}` from `users/{uid}` fields:
- `displayName`
- `isPublic`

- Script: `scripts/backfill-public-profiles.mjs`
- Dry run: `npm run backfill:public-profiles:dry`
- Apply: `npm run backfill:public-profiles:apply`

## Run all migrations in order

Runs all migration/backfill scripts sequentially in a recommended safe order.
- Defaults to dry-run.
- Full `beansLeft` recalculation is excluded by default; add `--include-recalculate` when needed.

- Script: `scripts/run-all-migrations.mjs`
- Dry run: `npm run migrations:all:dry`
- Apply: `npm run migrations:all:apply`

Examples:
- `npm run migrations:all:dry -- --uid <USER_UID>`
- `npm run migrations:all:apply -- --limit-users 100`
- `npm run migrations:all:dry -- --include-recalculate`

## Direct script usage examples

```bash
node scripts/migrate-single-source-fields.mjs --project coffee-dial-buzink --uid <USER_UID>
node scripts/recalculate-all-beans-left.mjs --apply --project coffee-dial-buzink --limit-users 100
```

## Sync brews with Tieme's app (simpleRecipes)

Copies Tieme's recipes from his app (`coffee-dial-app-9db38`, `users/{tieme}/simpleRecipes`) into Coffee Dial as brews, beans and coffee types, and Robert's Coffee Dial brews into Robert's `simpleRecipes` there (one document per coffee, newest brew per method and drink). Each run starts from the newest date the target already has, and written documents have fixed ids, so runs can overlap. It writes nowhere else.

- Script: `scripts/sync-simple-recipes.mjs`
- Dry run: `npm run sync:simple-recipes:dry`
- Apply: `npm run sync:simple-recipes:apply`
- Options: `--only tieme|robert`, `--since <ISO date>` (override the start date), `--adc` (use ADC instead of the active gcloud account)
