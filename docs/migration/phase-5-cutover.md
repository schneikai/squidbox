# Phase 5 — Cutover + cleanup (archived, done)

> Historical planning record. The migration is complete — see [`STATUS.md`](./STATUS.md).
> The current deploy runbook is the **`/deploy-server`** skill.

## Objective

Deploy the new backend, make the app run fully on it, and retire the Rails API + the old JSON-blob
backup path.

## Outcome

Done. Backend deployed to **Fly.io** (`squidbox-server`, region `lhr`) with **Neon Postgres**
(Frankfurt) and **AWS S3** (`eu-west-1`); config in `apps/server/{Dockerfile,fly.toml}`, driven by
the `/deploy-server` skill (idempotent setup + routine deploy; migrations run via
`release_command`). The app's file-transfer clients moved to the new backend endpoints
(`assets/download-urls`, `assets/upload/*`, `assets/delete`) and the legacy JSON "Backup / Load from
cloud" feature was removed.

Remaining cleanup is **user-side** (see `STATUS.md` / `/todo.md`): retire the old DigitalOcean Rails
droplet and rotate the AWS keys.
</content>
