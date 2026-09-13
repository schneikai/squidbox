---
name: build
description: Build the Squidbox iOS app from the cloud (no Mac needed) via EAS + an App Store Connect API Key. Builds either the App (preview/release) or the Dev Client. Use when the user asks to build, rebuild, preview, ship, or set up a dev client / release build for iOS. The skill ASKS which one to build — the user never types eas flags or profiles.
---

# Cloud iOS Build (no Mac)

Build the Squidbox iOS app with EAS. Apple auth uses an **App Store Connect API Key** — no Mac,
no Apple ID password, no 2FA (those are blocked from cloud IPs). The AGENT runs all commands; the
user only answers "which build?" and supplies secrets. **Run every command from `apps/mobile/`.**

## STEP 0 — Ask what to build (always do this first)

Use AskUserQuestion:
- **App** — the preview/release build. Bundle `com.schneikai.squidbox`, name "Squidbox", EAS profile
  `preview`, self-contained (JS baked in). `EXPO_PUBLIC_*` come from **EAS secrets** at build time.
- **Dev Client** — the development build. Bundle `com.schneikai.squidbox.dev`, name "Squidbox (Dev)",
  EAS profile `development`, loads JS live from Metro over the ngrok tunnel (hot reload).
  `EXPO_PUBLIC_*` come from **`.env.local`** at runtime.

Then follow the matching path below. (Both share the one-time credential setup.)

## Prerequisites (one-time per machine; ask the user for these)

- `eas-cli`: `npm i -g eas-cli` (or use `npx eas-cli`). `expect`: `brew install expect` (for the
  TTY-driven credential prompts on first build).
- **`EXPO_TOKEN`** — expo.dev → Account Settings → Access Tokens.
- **App Store Connect API key** on disk as `AuthKey_<KEY_ID>.p8` (gitignored via `*.p8`; never print
  its contents) + **`EXPO_ASC_KEY_ID`**, **`EXPO_ASC_ISSUER_ID`** (App Store Connect → Users and
  Access → Integrations), **`EXPO_APPLE_TEAM_ID`** (developer.apple.com → Membership),
  **`EXPO_APPLE_TEAM_TYPE=INDIVIDUAL`**.

Export before building:
```
EXPO_TOKEN, EAS_BUILD_PROFILE, CI=1,
EXPO_ASC_API_KEY_PATH, EXPO_ASC_KEY_ID, EXPO_ASC_ISSUER_ID,
EXPO_APPLE_TEAM_ID, EXPO_APPLE_TEAM_TYPE=INDIVIDUAL
```
Verify with `scripts/check-env.sh`. Routine rebuilds reuse stored credentials, so the `.p8` + ASC
IDs are only needed for the FIRST build on each bundle id (or to repair credentials).

## First build on a bundle id (either path)

Native modules need signing set up once per bundle id. Its prompts need `expect` in a headless shell:
```
eas credentials:configure-build -p ios -e <development|preview>
```
Answer: reuse the distribution certificate (Y), select provisioned devices (defaults fine), generate
a new ad-hoc provisioning profile (Y). (Reuses the existing cert; only mints a profile for the bundle id.)

## Path A — Dev Client

1. `EXPO_PUBLIC_API_URL` in `apps/mobile/.env.local` must be reachable from the phone — currently the
   live backend: `https://squidbox-server.fly.dev/api/v1`. (Dev client reads this at runtime.)
2. Build: `EAS_BUILD_PROFILE=development eas build -p ios -e development` (agent runs it).
3. Install on the phone from the EAS build page → **Internal Distribution → Install**; trust the dev
   cert in **Settings → General → VPN & Device Management**.
4. Start Metro + tunnel so the dev client can load JS (agent runs both, from `apps/mobile/`):
   ```
   NGROK_AUTHTOKEN=<from .env.local> node tunnel.js        # prints TUNNEL_URL=https://<host>
   EXPO_PACKAGER_PROXY_URL=https://<host> npx expo start --offline   # dev-client mode (no --go)
   ```
   Verify the tunnel serves Metro: `curl -s -o /dev/null -w "%{http_code}" https://<host>/status` → 200.
   Then open **Squidbox (Dev)** and point it at the tunnel URL.
5. After a native-module change, rebuild (steps 2–3). JS-only changes just hot-reload over the tunnel.

## Path B — App (preview/release)

The preview build BAKES `EXPO_PUBLIC_*` into the JS bundle at build time from **EAS environment
variables** (NOT `.env.local` — that's dev-client only). See "Env vars & secrets (how baking works)"
below; the gotchas there are load-bearing.

1. Confirm the baked env is correct for the live backend:
   `eas env:list --environment preview` → `EXPO_PUBLIC_API_URL` must be the Fly URL
   (`https://squidbox-server.fly.dev/api/v1`), and `EXPO_PUBLIC_OPENAI_API_KEY` + `SENTRY_AUTH_TOKEN`
   should exist. If the URL is stale/wrong, fix the VALUE (keep its visibility):
   `eas env:set --name EXPO_PUBLIC_API_URL --value <fly-url> --visibility secret --environment development --environment preview --environment production`
2. Build: `EAS_BUILD_PROFILE=preview eas build -p ios -e preview` (agent runs it).
3. Install from the EAS build page → **Internal Distribution → Install**. Self-contained — no Metro/tunnel.
4. Do NOT run `eas submit` on `development`/`preview` (those are internal builds, not TestFlight).

## Env vars & secrets (how baking works) — READ if a build "can't reach the server"

Hard-won facts (SDK 55 / current EAS CLI):
- **`environment` per profile is REQUIRED.** eas.json's build profiles set `"environment"`
  (development/preview/production). Without it, EAS injects **none** of the stored env vars → the app
  builds with `EXPO_PUBLIC_API_URL` undefined → every request fails locally → "Can't reach server"
  and **nothing hits the backend logs**.
- **EAS server vars OVERRIDE eas.json `env`** for the same name. Setting `EXPO_PUBLIC_API_URL` in
  eas.json `env` is silently ignored if a server var of that name exists — fix the server var instead.
- **`secret`-visibility `EXPO_PUBLIC_*` vars DO inline** into the JS bundle here (despite Expo docs
  implying otherwise). So a stale `secret` value gets baked. You can't flip a `secret` → `plaintext`
  (`eas env:set` errors); update its value in place with `--visibility secret`, or delete + recreate.
- A `secret` value can't be read back. To verify what actually baked, download the .ipa and grep:
  `unzip -o app.ipa -d x && strings x/Payload/*.app/main.jsbundle | grep -oE "https://[a-z0-9.-]+/api/v1"`.
- Classic failure we hit: the app logged in fine (old Rails backend still up) but sync failed —
  because the baked `EXPO_PUBLIC_API_URL` was the **stale Rails URL** from an old `eas secret` push,
  not the Fly URL. Login worked; `/sync/*` didn't exist there.
- `EXPO_PUBLIC_OPENAI_API_KEY` is baked into the binary regardless (that's what `EXPO_PUBLIC_` means);
  keeping it `secret` only hides it from logs/UI, not from the shipped app.

## Watch / manage

Build with `--no-wait` (returns a build id immediately), then poll status in the background. iOS
builds here usually finish in well under 10 minutes, so **poll every ~5 minutes** — no need for a
tight loop. Stop when status is `FINISHED`/`ERRORED`/`CANCELED`, then fetch the install URL.

`eas build:list --platform ios --limit 5` · `eas build:view <build-id>` (add `--json` to parse
`.status`) · logs at the EAS build page.

**Install QR.** `--no-wait` skips EAS's own QR, so render one for the build page (scan with the
iPhone camera → opens the page → tap Install; EAS has no direct-install QR for internal builds):
```bash
node -e 'require("qrcode-terminal").generate("https://expo.dev/accounts/<acct>/projects/squidbox/builds/<build-id>",{small:true},c=>process.stdout.write(c))'
```
If `qrcode-terminal` isn't resolvable, install it to a temp prefix first:
`npm install qrcode-terminal --no-save --prefix /tmp/qrtool` and require
`/tmp/qrtool/node_modules/qrcode-terminal`. Show the QR in a fenced block and also paste the plain
URL (terminals may squish the blocks).

## Troubleshooting

- **"Invalid username and password combination"** → Apple ID + 2FA is blocked from cloud IPs. Use the
  ASC API Key (`EXPO_ASC_*`); never attempt Apple ID password auth from a cloud shell.
- **"Failed to set up credentials / non-interactive mode"** (new bundle id) → run
  `eas credentials:configure-build` via `expect`.
- **Dev client overwrites the App (or vice-versa)** → `EAS_BUILD_PROFILE` wasn't exported, so
  app.config.js fell back to the default bundle id. Confirm it matches the profile passed to `eas build`.

## Security

- Never print or commit the `.p8` contents, Apple password, `EXPO_TOKEN`, or any secret — reference
  env-var NAMES, not values.
- Revocable: ASC key at App Store Connect → Integrations → Team Keys; Expo token at expo.dev → Access
  Tokens. After a session where credentials were shared in chat, advise rotating them.
- Scrub local log/expect files that may have captured credentials (`rm -f *.log *.exp /tmp/2fa_code.txt`).
