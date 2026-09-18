# Database backups

Two layers protect the production Neon Postgres DB (metadata only — media lives in S3):

1. **In-Neon (automatic):** point-in-time restore + snapshots. Configure retention and a
   snapshot schedule in the Neon console → **Backup & Restore**. This is instant to restore
   but is lost if the Neon project/account is lost.
2. **Off-site (this repo):** a daily `pg_dump` pushed to **S3**, via
   `.github/workflows/db-backup.yml`. This is the disaster-recovery copy you own.

Once the one-time setup below is done, the off-site backup is fully automatic — nothing to run
by hand. It runs daily at 03:00 UTC and can also be triggered from the Actions tab
(**db-backup → Run workflow**).

## One-time setup

### 1. GitHub Actions secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
| --- | --- |
| `NEON_DATABASE_URL` | The Neon connection string (Neon console → Connect, or the Fly `DATABASE_URL` secret). |
| `BACKUP_S3_BUCKET` | Bucket that receives dumps (see below — a dedicated bucket is recommended). |
| `BACKUP_AWS_ACCESS_KEY_ID` | Access key for a **backup-only** IAM user (see policy below). |
| `BACKUP_AWS_SECRET_ACCESS_KEY` | Its secret. |

Until these exist the workflow runs but fails — it is inert, not silently skipped, so a broken
setup is visible in the Actions tab (and you can enable failure notifications).

### 2. S3 bucket + rolling retention

Backups go to `s3://<bucket>/db-backups/`. Use a **separate bucket** (not the media bucket) so a
scoped key can't touch your photos. Add a **lifecycle rule** on the `db-backups/` prefix to expire
objects after, e.g., **30 days** — that gives rolling retention with no code to prune.

### 3. Least-privilege IAM user (recommended)

Create a dedicated IAM user whose only power is writing backups:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": "s3:PutObject", "Resource": "arn:aws:s3:::<bucket>/db-backups/*" }
  ]
}
```

Use that user's keys for `BACKUP_AWS_*`. Do **not** reuse the app's S3 credentials.

## Restore

Download a dump and restore into a fresh database (never restore over a live one):

```bash
aws s3 cp s3://<bucket>/db-backups/squidbox-YYYYMMDDT...Z.dump ./restore.dump
pg_restore -d "$TARGET_DATABASE_URL" --clean --if-exists --no-owner ./restore.dump
```

For a quick "oops" within the last day, prefer Neon's point-in-time restore/branch instead —
it's instant and non-destructive.

## Notes

- `pg_dump` must be **≥** the server's major version; the workflow runs `pg_dump` from the
  `postgres:18` Docker image to match Neon (PG 18). Bump the image tag if Neon upgrades its major version.
- The dump is custom-format (`-Fc`); restore with `pg_restore`, not `psql`.
