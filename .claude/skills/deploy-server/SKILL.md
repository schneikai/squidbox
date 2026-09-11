---
name: deploy-server
description: Deploy the Squidbox backend (apps/server) to Fly.io — first-time setup (app + managed Postgres + secrets + seed) and routine one-command deploys. Use when the user asks to deploy, set up hosting, ship the server, push a backend change, or run migrations in production.
---

# Deploy server (Fly.io)

The backend is an always-on container (large streaming uploads can't run on serverless). Config
lives in `apps/server/fly.toml` + `apps/server/Dockerfile`; the image runs the server via tsx and
installs only the server's deps (validated with a local `docker build`). Region `lhr` is closest to
the S3 bucket in AWS `eu-west-1`. **Always deploy from the repo ROOT** so the build context includes
`packages/shared`.

## One-time prerequisites (per machine, done by the user)

- Install flyctl: `brew install flyctl` (or `curl -L https://fly.io/install.sh | sh`).
- `fly auth login` (opens a browser — a human step; can't be automated here).

## First-time setup

1. **Create the app** (pick a name; update `app = "..."` in `apps/server/fly.toml` to match):
   `fly apps create squidbox-server`
2. **Managed Postgres** — create + attach (attach sets the `DATABASE_URL` secret automatically):
   `fly postgres create --name squidbox-db --region lhr`
   `fly postgres attach squidbox-db --app squidbox-server`
3. **Secrets** (never commit these). `JWT_SECRET` MUST equal the Rails `secret_key_base` so existing
   tokens/passwords interoperate:
   ```
   fly secrets set --app squidbox-server \
     JWT_SECRET=<rails secret_key_base> \
     AWS_REGION=eu-west-1 \
     AWS_ACCESS_KEY_ID=<key> AWS_SECRET_ACCESS_KEY=<secret> \
     S3_SHARED_BUCKET=squidbox-shared \
     SEED_USER_EMAIL=schneikai@gmail.com \
     SEED_USER_STORAGE_BUCKET=u41od6cqgqfo \
     SEED_USER_PASSWORD=<password> \
     CONVERT_USER_EMAIL=schneikai@gmail.com
   ```
4. **Deploy** (runs migrations via `release_command` before going live):
   `fly deploy --config apps/server/fly.toml`  (from the repo root)
5. **Seed the account:** `fly ssh console --app squidbox-server -C "npm run seed:prod"`
6. **(Optional) Import the legacy library** into the deployed DB — same as the `/legacy-import`
   runbook, but on Fly: `fly ssh console --app squidbox-server -C "npm run convert:prod"`
   (idempotent; downloads the S3 JSON, canonicalizes ids to uuids, imports parents + edges).
7. **Point the app at it:** set `EXPO_PUBLIC_API_URL=https://squidbox-server.fly.dev/api/v1` in
   `apps/mobile/.env.local`, then rebuild the dev client (`/cloud-ios-build`).

## Routine deploy (the common case)

From the repo root: `fly deploy --config apps/server/fly.toml`
Migrations run automatically (idempotent `release_command`). Verify: `curl https://squidbox-server.fly.dev/up` → `{"status":"ok"}`.

## Notes / gotchas

- **Always-on:** `auto_stop_machines = false` — do not enable auto-stop; it would kill in-flight
  multi-GB uploads.
- **Health:** `GET /up`. Fly health-checks it every 30s.
- **Logs:** `fly logs --app squidbox-server`. **Shell:** `fly ssh console --app squidbox-server`.
- **Secrets change** → `fly secrets set ...` triggers a rolling restart automatically.
- **Never commit** secrets, `.env`, or the Rails `secret_key_base`.
