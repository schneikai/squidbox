---
name: deploy-server
description: Deploy the Squidbox backend (apps/server) to Fly.io (Neon Postgres) — the routine one-command deploy, with migrations. Use when the user asks to deploy, ship the server, push a backend change, or run migrations in production.
---

# Deploy server (Fly.io + Neon)

The backend is an always-on Fly container (large streaming uploads can't run on serverless), app
`squidbox-server` in region `lhr` (London, closest to the S3 bucket in AWS `eu-west-1`). The DB is
Neon Postgres. Config: `apps/server/fly.toml` + `apps/server/Dockerfile` (lean image: installs only
the server's deps, vendors `@squidbox/shared` as source, runs via tsx).

**Secrets** (`fly secrets list --app squidbox-server`): `DATABASE_URL` (Neon's direct URL, never the
pooled one: it breaks the migrations' advisory locks), `JWT_SECRET` (changing it signs every device
out), `SERVER_ID`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_SHARED_BUCKET`,
`VENICE_API_KEY`. `SERVER_ID` is the server's stable identity (the app binds each session and library
to it, `docs/sync-design.md` §8): never set it to a new value, or the next sign-in opens a new, empty
library and parks the existing one. Never store a password as a secret.

## Routine deploy

From the repo root: `fly deploy . --config apps/server/fly.toml --dockerfile apps/server/Dockerfile`
Migrations run automatically. Verify: `curl https://squidbox-server.fly.dev/up` → `{"status":"ok","serverId":"<uuid>"}`.

`SERVER_ID` must be set as a secret before the deploy that first needs it; the server refuses to
boot without it. Check it with `fly secrets list --app squidbox-server` before deploying, and never re-set
it to a new value (see Secrets above). From the cloud workspace, deploy as below instead.

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
- **Health:** `GET /up`. **Logs:** `fly logs --app squidbox-server`. **Shell:** `fly ssh console --app squidbox-server`.
- **Never commit** secrets, `.env`, or connection strings. Consider rotating any AWS key / DB URL
  that has appeared in a terminal/chat.
