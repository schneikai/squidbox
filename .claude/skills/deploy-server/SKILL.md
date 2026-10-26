---
name: deploy-server
description: Deploy the Squidbox backend (apps/server) to Fly.io with a Neon Postgres DB — first-time setup (app + Neon DB + secrets + seed) and routine one-command deploys, driven via the fly + neonctl CLIs. Use when the user asks to deploy, set up hosting, ship the server, push a backend change, or run migrations in production. (Importing a user's old backups is separate — see the legacy-import skill.)
---

# Deploy server (Fly.io + Neon)

The backend is an always-on Fly container (large streaming uploads can't run on serverless). The DB
is Neon Postgres (free tier is plenty for a single user). Config: `apps/server/fly.toml` +
`apps/server/Dockerfile` (lean image: installs only the server's deps, vendors `@squidbox/shared` as
source, runs via tsx). Fly region `lhr` (London) is closest to the S3 bucket in AWS `eu-west-1`.

**Deploy from the repo ROOT with an explicit context + dockerfile** (the build needs `packages/shared`,
which is above the fly.toml dir):
`fly deploy . --config apps/server/fly.toml --dockerfile apps/server/Dockerfile`

## How this skill decides: setup vs deploy (ONE idempotent skill)

Run it anytime — it detects what already exists and does only the missing steps, then always
deploys. No separate "setup" vs "deploy" skill to choose.

- App exists?  `fly status --app <app>` → errors ⇒ do step 1 (create app).
- Neon project exists?  `neonctl projects list --org-id <org>` → none ⇒ do step 2.
- Secrets set?  `fly secrets list --app <app>` → missing keys ⇒ do step 3.
- User seeded? only seed (step 6) on first setup.
- Always finish with the deploy (step 4) — that's the routine case on its own.

## Prerequisites (CLIs — installable + drivable by the agent)

- `brew install flyctl` and `brew install neonctl`.
- Auth (each opens a browser once — the human step): `fly auth login`, and `neonctl me`
  (running any neonctl command triggers the browser auth). Tell the user when to approve it.

## Setup steps (each is skipped if already present — see "How this skill decides")

1. **Fly app:** `fly apps create <app> --org personal` (name is globally unique; update `app=` in fly.toml).
2. **Neon project** (get the org id from `neonctl orgs list`):
   `neonctl projects create --name Squidbox --org-id <org> --region-id aws-eu-central-1 --output json`
   Grab `.project.id`, then the DIRECT (unpooled) URL: `neonctl connection-string --project-id <id> --org-id <org>`
   (pooled/pgbouncer breaks advisory locks + migrations — do NOT use `--pooled`).
3. **Secrets** — set all at once. Pull the DB URL from neonctl (never echo it), generate JWT + login
   password, and read AWS creds from `apps/server/.env` (avoids credential literals in the command,
   which the sandbox blocks). `JWT_SECRET` is a random secret;
   changing it signs every device out. `SERVER_ID` is the server's stable identity (the app binds
   each session and library to it, `docs/sync-design.md` §8): generate it once and never change it.
   A changed id is another server to the app: the next sign-in opens a new, empty library and
   parks the existing one. `SEED_USER_PASSWORD` is the app login password.
   ```bash
   AWS_KEY=$(grep '^AWS_ACCESS_KEY_ID=' apps/server/.env | cut -d= -f2-)
   AWS_SEC=$(grep '^AWS_SECRET_ACCESS_KEY=' apps/server/.env | cut -d= -f2-)
   DBURL=$(neonctl connection-string --project-id <id> --org-id <org>)
   PW=$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 16)
   fly secrets set --app <app> \
     DATABASE_URL="$DBURL" JWT_SECRET="$(openssl rand -hex 32)" SERVER_ID="$(uuidgen | tr A-Z a-z)" \
     AWS_REGION=eu-west-1 AWS_ACCESS_KEY_ID="$AWS_KEY" AWS_SECRET_ACCESS_KEY="$AWS_SEC" \
     S3_SHARED_BUCKET=squidbox-shared \
     SEED_USER_EMAIL=<email> SEED_USER_STORAGE_BUCKET=<bucket> SEED_USER_PASSWORD="$PW" \
     CONVERT_USER_EMAIL=<email>
   echo "APP LOGIN PASSWORD: $PW"  # report to the user
   ```
4. **Deploy:** `fly deploy . --config apps/server/fly.toml --dockerfile apps/server/Dockerfile`
   (runs `npm run migrate:prod` via `release_command` before going live).
5. **Scale to 1 machine** (Fly defaults to 2 for HA — unneeded for one user, halves cost):
   `fly scale count 1 --app <app> --yes`
6. **Seed:** `fly ssh console --app <app> -C "npm run seed:prod"`
7. **Point the app at it:** set `EXPO_PUBLIC_API_URL=https://<app>.fly.dev/api/v1` in
   `apps/mobile/.env.local` (the dev client uses it only on the owner's request, README → "Local
   backend with mock data"). For the preview app, update the EAS environment variable and rebuild
   (see the `ios-build` skill, Path B).

> Importing a user's old backups is separate from deploying. Use the **`/legacy-import`** skill
> (`npm run convert:prod` on the app).

## Routine deploy

From the repo root: `fly deploy . --config apps/server/fly.toml --dockerfile apps/server/Dockerfile`
Migrations run automatically. Verify: `curl https://<app>.fly.dev/up` → `{"status":"ok","serverId":"<uuid>"}`.

**Cloud workspace (agent proxy):** Fly's Depot builder talks gRPC, which the workspace proxy can't
carry ("x509: certificate signed by unknown authority"). Build locally and deploy the image instead:
start `dockerd` with `SSL_CERT_FILE=/root/.ccr/ca-bundle.crt` (and the shell's `HTTPS_PROXY`), then
build with a copy of `apps/server/Dockerfile` whose `npm install` step bind-mounts the CA only for
that step (`RUN --mount=type=bind,from=ca,source=ca.crt,target=/tmp/ca.crt NODE_EXTRA_CA_CERTS=/tmp/ca.crt npm_config_cafile=/tmp/ca.crt npm …`):
```bash
docker build --network host --build-arg HTTPS_PROXY="$HTTPS_PROXY" --build-arg HTTP_PROXY="$HTTPS_PROXY" \
  --build-context ca=<dir holding ca.crt> -f <that Dockerfile> -t registry.fly.io/<app>:<tag> .
fly auth docker && docker push registry.fly.io/<app>:<tag>
fly deploy --config apps/server/fly.toml --image registry.fly.io/<app>:<tag>
```
The CA never lands in the image, and the release command still runs the migrations.
`SERVER_ID` must be set as a secret before the deploy that first needs it; the server refuses to
boot without it. Check it with `fly secrets list --app <app>` before deploying, and never re-set
it to a new value (see step 3).

### From the cloud workspace (behind the agent proxy)

The plain deploy fails there: Fly's remote (Depot) builder speaks gRPC, which the proxy doesn't
carry; Docker Hub rate-limits the shared IP; and build containers neither reach the proxy nor trust
its CA. Build the image locally instead and deploy it:

1. Install the CLI: `curl -L https://fly.io/install.sh | sh` (then `~/.fly/bin/flyctl`). Log in with
   `BROWSER=echo flyctl auth login` in the background; the user approves the printed URL, and
   if they do it on another machine, finish with `flyctl auth login --code <code they paste>`.
2. Base image from Google's Docker Hub mirror:
   `docker pull mirror.gcr.io/library/node:20-slim && docker tag mirror.gcr.io/library/node:20-slim node:20-slim`
3. Copy the Dockerfile to the scratchpad so that only `npm install` trusts the proxy CA (the final
   image carries no proxy settings), then build with the host network:
   ```bash
   sed 's|^RUN npm pkg delete|ARG HTTPS_PROXY\nRUN --mount=type=bind,from=ccr,source=ca-bundle.crt,target=/tmp/ca.crt export NODE_EXTRA_CA_CERTS=/tmp/ca.crt https_proxy=$HTTPS_PROXY \&\& npm pkg delete|' \
     apps/server/Dockerfile > "$SCRATCH/Dockerfile.deploy"
   docker buildx build --network host --build-context ccr=/root/.ccr --build-arg HTTPS_PROXY="$HTTPS_PROXY" \
     -f "$SCRATCH/Dockerfile.deploy" -t squidbox-server:$(git rev-parse --short HEAD) --load .
   ```
4. `SSL_CERT_FILE=/root/.ccr/ca-bundle.crt flyctl deploy --config apps/server/fly.toml --image squidbox-server:<sha> --local-only`
   (the AAAA "DNS verification failed" warning there is the workspace resolver, not the app).

## Notes / gotchas

- **Always-on:** `auto_stop_machines = false` — don't enable auto-stop; it would kill in-flight
  multi-GB uploads.
- **Neon SSL:** the DB client enables TLS automatically for `*.neon.tech` / `sslmode=require`
  (see `db/client.ts`); local docker stays non-SSL.
- **Health:** `GET /up`. **Logs:** `fly logs --app <app>`. **Shell:** `fly ssh console --app <app>`.
- **Never commit** secrets, `.env`, or connection strings. Consider rotating any AWS key / DB URL
  that has appeared in a terminal/chat.
