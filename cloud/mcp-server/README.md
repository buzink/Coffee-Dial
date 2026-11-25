# Coffee Dial MCP server

A remote [MCP](https://modelcontextprotocol.io) server that lets Claude (Claude Code and claude.ai) read and change a signed-in user's Coffee Dial data: coffees, bags, brews, gear and analyses. It runs on Google Cloud Run in project `coffee-dial-buzink` and talks to Firestore with the Admin SDK.

Every user sees only their own data. The Firebase uid of the signed-in account is the only key for Firestore paths, and every path is built under `users/{uid}`.

## What it exposes

| Tool | Kind | What it does |
| --- | --- | --- |
| `list_coffees` | read | Coffees (`users/{uid}/coffeeTypes`) |
| `list_bags` | read | Bags (`users/{uid}/beans`), with calculated `beansLeft` |
| `list_brews` | read | Brews (`users/{uid}/coffees`), newest first; filter by bag or method |
| `list_gear` | read | Gear (`users/{uid}/gear`) |
| `get_analysis` | read | Counts and average ratings per method and per bag, computed on the server |
| `get_brew_graph` | read, on request | Scale capture of one brew (`users/{uid}/brewGraphs`) |
| `upsert_coffee` | write | Add or change a coffee |
| `upsert_bag` | write | Add or change a bag |
| `upsert_brew` | write | Add or change a brew |
| `upsert_gear` | write | Add or change gear |

Every write tool takes `apply` (default `false`). With `false` it only returns the proposed change, with the fields that differ and any side effects. With `true` it writes.

Single source of truth: coffee details live only on the coffee, bag details only on the bag, brew details only on the brew, and a grinder is gear linked by `gearIds`. A write that puts a field on the wrong entity is refused with a hint, for example "Coffee details belong on the coffee: change them with upsert_coffee".

## Endpoints

- `/mcp`: the MCP endpoint (Streamable HTTP, stateless, bearer token required).
- `/.well-known/oauth-protected-resource` (RFC 9728) and `/.well-known/oauth-authorization-server` (RFC 8414).
- `/oauth/register` (RFC 7591 dynamic client registration), `/oauth/authorize`, `/oauth/callback`, `/oauth/token`.
- `/healthz`.

## How sign-in works

Google does not support dynamic client registration, and MCP clients expect it. So this server is also a small OAuth 2.1 proxy:

1. The MCP client registers itself at `/oauth/register`. The "client id" is a signed token that lists the client's redirect URIs; nothing is stored.
2. The client starts `/oauth/authorize` with PKCE (S256 is required). The server redirects to Google (scopes `openid email`) with a signed `state`.
3. Google returns to `/oauth/callback`. The server exchanges the code, verifies the id token, and requires a **verified** email.
4. The server maps the Google account to a Firebase uid (see below) and issues a short-lived code. The client exchanges it at `/oauth/token` with its PKCE verifier and gets an access token (1 hour) and a refresh token (30 days).
5. Every `/mcp` call verifies the bearer token. Only tokens issued by this server are accepted.

Tokens are JWTs signed with a key derived from the Google client secret (HKDF). No token store is needed, so any Cloud Run instance can verify them. The trade-offs: a token cannot be revoked one by one. Rotating the Google client secret invalidates all tokens, and the allowlist blocks an account at the next call.

### Which uid owns the data

The app stores data under the **Firebase Auth uid**, which is not the Google account id. The server maps the Google account like this:

1. a Firebase user linked to this Google account (provider `google.com`);
2. otherwise, a Firebase user with the same email, but only if Firebase marks that email verified;
3. otherwise, the empty namespace `google-<sub>`. A new account sees an empty environment. Its data is not linked to any Firebase account that might be created later.

The lookups need the `roles/firebaseauth.viewer` role on the runtime service account.

## Optional allowlist (`ALLOWED_EMAIL`, comma-separated)

- **Set**: only the accounts with those emails can sign in. Other accounts get a clear message at login, and a 403 on `/mcp` with the same message.
- **Empty or unset**: every account with a verified Google email can sign in, and sees only its own data. Write limits (below) then matter more.

The address is read from the environment, which Cloud Run fills from Secret Manager (`--set-secrets`). It is never hardcoded or logged. Set the GitHub repository variable `MCP_ALLOWED_EMAIL_SECRET` to the name of a Secret Manager secret that holds the address to turn it on in the deploy.

## Limits against misuse

Without an allowlist, any verified Google account can call the server. The server therefore limits:

- `MCP_WRITE_LIMIT_PER_HOUR` (default `60`): applied writes per user per hour. The counter lives in `users/{uid}/mcpLimits/writes`, so all instances share it. Dry runs are not counted.
- `MCP_MAX_DOC_BYTES` (default `32768`): the largest document the server writes, as JSON bytes.
- `MCP_MAX_GRAPH_BYTES` (default `200000`): the largest brew graph `get_brew_graph` returns.
- `MCP_LIST_MAX` (default `500`): the largest number of rows a list returns.

Text fields have their own maximum lengths; see `src/validate.js`.

## Configuration

| Variable | Required | Notes |
| --- | --- | --- |
| `PUBLIC_BASE_URL` | yes in production | Public URL without a trailing slash. Used as issuer and in the Google redirect URI. |
| `GOOGLE_CLIENT_ID` | yes | Secret Manager: `coffee-dial-mcp-google-client-id` |
| `GOOGLE_CLIENT_SECRET` | yes | Secret Manager: `coffee-dial-mcp-google-client-secret` |
| `ALLOWED_EMAIL` | no | Secret Manager, see above |
| `FIRESTORE_PROJECT_ID` | no | Default `coffee-dial-buzink` |
| `MCP_WRITE_LIMIT_PER_HOUR`, `MCP_MAX_DOC_BYTES`, `MCP_MAX_GRAPH_BYTES`, `MCP_LIST_MAX` | no | See above |
| `PORT` | no | Cloud Run sets it. Default `8080`. |

## One-time setup (done by a person, not by the deploy)

### 1. Google OAuth client

In the Cloud console for `coffee-dial-buzink` (APIs & Services > Credentials), create an **OAuth client ID** of type **Web application**, with:

- Authorized redirect URI: `https://coffee-dial-mcp-2jblv7qija-uc.a.run.app/oauth/callback`

The URL is the one the deploy workflow expects (`PUBLIC_BASE_URL`). If Cloud Run gives the service another URL, the deploy fails and tells you which one; change the workflow variable and this redirect URI to match.

If the OAuth consent screen is in *Testing*, add your Google account as a test user.

### 2. Secrets

```bash
gcloud secrets create coffee-dial-mcp-google-client-id --project coffee-dial-buzink --replication-policy=automatic
gcloud secrets create coffee-dial-mcp-google-client-secret --project coffee-dial-buzink --replication-policy=automatic
# Paste the real values when prompted. They are not stored in this repo or in chat.
read -r "?Google OAuth client ID: " CLIENT_ID && printf '%s' "$CLIENT_ID" | gcloud secrets versions add coffee-dial-mcp-google-client-id --project coffee-dial-buzink --data-file=-
read -rs "?Google OAuth client secret: " CLIENT_SECRET && echo && printf '%s' "$CLIENT_SECRET" | gcloud secrets versions add coffee-dial-mcp-google-client-secret --project coffee-dial-buzink --data-file=-

# Cloud Run reads secrets when an instance starts. Force a new revision after changing them:
gcloud run services update coffee-dial-mcp --project coffee-dial-buzink --region us-central1 --update-env-vars SECRETS_REFRESHED=$(date +%s)
```

### 3. Runtime service account and roles

```bash
gcloud iam service-accounts create coffee-dial-mcp --project coffee-dial-buzink --display-name "Coffee Dial MCP"
SA=coffee-dial-mcp@coffee-dial-buzink.iam.gserviceaccount.com
gcloud projects add-iam-policy-binding coffee-dial-buzink --member "serviceAccount:$SA" --role roles/datastore.user
gcloud projects add-iam-policy-binding coffee-dial-buzink --member "serviceAccount:$SA" --role roles/firebaseauth.viewer
for s in coffee-dial-mcp-google-client-id coffee-dial-mcp-google-client-secret; do
  gcloud secrets add-iam-policy-binding "$s" --project coffee-dial-buzink --member "serviceAccount:$SA" --role roles/secretmanager.secretAccessor
done
```

The deployer (the workload identity service account used by GitHub Actions, `GCP_DEPLOYER_SERVICE_ACCOUNT`) also needs to deploy from source and to use the runtime account: `roles/run.admin`, `roles/iam.serviceAccountUser` on `coffee-dial-mcp`, `roles/cloudbuild.builds.editor`, `roles/artifactregistry.writer`, and `roles/storage.admin` for the source bucket. Check the first deploy log if one of these is missing.

### 4. Deploy

The workflow `.github/workflows/deploy-mcp-server.yml` runs the tests against the emulators and then deploys on pushes to `main` that touch this folder. It uses the existing workload identity federation secrets (`GCP_PROJECT_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_DEPLOYER_SERVICE_ACCOUNT`); no keys are stored.

The service is deployed with `--allow-unauthenticated`. That is intentional: MCP clients must reach the endpoint and then present a bearer token, which this server checks. Cloud Run IAM is not the access control here.

## Connect a client

### Claude Code

```bash
claude mcp add --transport http coffee-dial https://coffee-dial-mcp-2jblv7qija-uc.a.run.app/mcp
```

Then run `/mcp` in Claude Code and choose the server to sign in with Google.

### claude.ai

Settings > Connectors > Add custom connector, URL `https://coffee-dial-mcp-2jblv7qija-uc.a.run.app/mcp`. Sign in with the Google account that owns the Coffee Dial data.

## Development

```bash
cd cloud/mcp-server
npm ci
npm test        # starts the Firestore and Auth emulators (needs Java 21+) and runs the tests
```

`npm test` refuses to run without the emulator environment variables, so the tests cannot reach the real project. To run the server locally against the emulators:

```bash
PORT=8090 PUBLIC_BASE_URL=http://localhost:8090 GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... \
  FIRESTORE_EMULATOR_HOST=127.0.0.1:8181 node src/server.js
```

The tests cover: a tool never touches a path outside `users/{uid}`; a new account sees only an empty environment; with an allowlist set, another address gets 403; the write limit and document size limit; single-source refusals; the beansLeft calculation; the full OAuth flow with PKCE (with a stand-in for Google's token exchange).

## Not covered by the tests

- The real Google sign-in and the real Google token exchange (the tests use a stand-in).
- Claude Code and claude.ai talking to the deployed server.
- The deploy itself and the IAM roles on the real project.
- Authorization codes are valid for 60 seconds and are not single use; PKCE stops a stolen code from being used without its verifier.
