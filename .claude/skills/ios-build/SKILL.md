---
name: ios-build
description: Build the Squidbox iOS app from the cloud (no Mac needed) via EAS + an App Store Connect API Key. Builds either the App (preview/release) or the Dev Client, or ships a JS-only change to the installed App as an EAS update. Use when the user asks for an iOS build: a rebuild, a preview or release build, a dev client, or an update of the installed App. Not for implementing features; that is the `build` skill. The skill ASKS which one to build — the user never types eas flags or profiles.
---

# Cloud iOS Build (no Mac)

Build the Squidbox iOS app with EAS. Apple auth uses an **App Store Connect API Key** — no Mac,
no Apple ID password, no 2FA (those are blocked from cloud IPs). The AGENT runs all commands; the
user only answers "which build?" and supplies secrets. **Run every command from `apps/mobile/`.**

## STEP 0 — Ask what to build (always do this first)

Use AskUserQuestion:

- **App** — the preview/release build. Bundle `com.schneikai.squidbox`, name "Squidbox", EAS profile
  `preview`, self-contained (JS baked in). `EXPO_PUBLIC_*` come from the profile's **EAS
  environment** at build time.
- **Dev Client** — the development build. Bundle `com.schneikai.squidbox.dev`, name "Squidbox (Dev)",
  EAS profile `development`, loads JS live from Metro over a tunnel (hot reload). Its icon is the
  dark DEV variant (`assets/icon-dev.png`, set in app.config.js). `EXPO_PUBLIC_*` come from
  **`.env.local`** at runtime.
- **Update** — a JS-only change to the installed App (preview or production), as an EAS update: no
  build, no install. Only when a finished build with the same native code exists (the script checks).

Then follow the matching path below. (The builds share the one-time credential setup.)

## Prerequisites (one-time per machine; ask the user for these)

- `eas-cli`: `npm i -g eas-cli` (or use `npx eas-cli`). A prompt driver for the TTY-driven
  credential prompts: `brew install expect`, or `pip install pexpect` in a Linux cloud shell.
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
IDs are only needed for the FIRST build on each bundle id, or to renew or repair credentials.

## First build on a bundle id, or expired signing (either path)

Signing is set up once per bundle id and renewed when it expires. The distribution certificate and
both ad hoc profiles currently run until **Oct 10, 2027**; an installed app stops opening ("is no
longer available") once its profile expires. Non-interactive mode refuses to fix expired
credentials, so run this step INTERACTIVELY through the prompt driver, with `CI` unset and without
`--non-interactive`:

```
SQUIDBOX_NOT_A_BUILD=1 EAS_BUILD_PROFILE=<profile> eas credentials:configure-build -p ios -e <development|preview>
```

Answer yes to reusing or regenerating the distribution certificate and to a new ad hoc profile, and
press Enter at device selection (all registered devices). With the `EXPO_ASC_*` vars set, the CLI
uses the API key. Abort only on a real prompt (a line starting with `?`) asking for an Apple ID or
password; an info line mentioning "username/password" cookies is not a prompt.

Alternatively, `eas build ... --non-interactive --refresh-ad-hoc-provisioning-profile` regenerates
just the profile during a build. That flag only works together with `--non-interactive`.

**Re-signing instead of rebuilding.** `SQUIDBOX_NOT_A_BUILD=1 eas build:resign -p ios -e <profile> --source-profile <profile>
--id <build-id>` re-signs an existing internal build with fresh credentials, without rebuilding.
EAS deletes build artifacts about 14 days after a build (`expirationDate` in
`eas build:list --json`), so it only works within that window; after that, rebuild.

## Path A — Dev Client

1. Build: `EAS_BUILD_PROFILE=development eas build -p ios -e development` (agent runs it).
2. Install on the phone from the EAS build page → **Internal Distribution → Install**; trust the dev
   cert in **Settings → General → VPN & Device Management**.
3. Start the dev client: `npm run dev:local` from the repo root (README → "Dev client"), then open
   **Squidbox (Dev)** at the URL it prints.
4. After a native-module change, rebuild (steps 1–2). JS-only changes just hot-reload over the tunnel.

## Path B — App (preview/release)

The preview build BAKES `EXPO_PUBLIC_*` into the JS bundle at build time from **EAS environment
variables** (NOT `.env.local` — that's dev-client only). See "Env vars & secrets (how baking works)"
below; the gotchas there are load-bearing.

1. `EXPO_PUBLIC_API_URL`'s value must be the Fly URL (`https://squidbox-server.fly.dev/api/v1`);
   read it with `eas env:get --name EXPO_PUBLIC_API_URL --environment preview`. If it is
   stale/wrong, fix the VALUE (keep its visibility):
   `eas env:set --name EXPO_PUBLIC_API_URL --value <fly-url> --visibility sensitive --environment development --environment preview --environment production`
   (The script checks that the variables the App needs exist.)
2. Build with ONE command, from the repo root (never `eas build -e preview` directly):
   ```bash
   npm run ios:app                  # or: npm run ios:app -- production
   ```
   It needs the checkout clean and at the pushed tip of its branch (else it stops and says why),
   writes the build's contract snapshot (`docs/sync-design.md` §15), commits and pushes it, and
   only then starts the EAS build (`--no-wait`) of the commit the snapshot names. A failed push
   builds nothing. `app.config.js` refuses an App build whose commit has no pushed snapshot; a
   re-sign or a credentials repair of an earlier build sets `SQUIDBOX_NOT_A_BUILD=1`.
   Build from `main`, or from a branch that will merge: the snapshot reaches main with the branch
   (a squash merge is fine: GitHub keeps the built commit fetchable through the pull request). If a
   built branch is dropped instead, cherry-pick its snapshot commit to main, so the installed build
   stays checked. What the snapshots are checked by, and retiring one: `docs/sync-design.md` §15.
3. Watch the build (see "Watch / manage") until `FINISHED`.
4. Install from the EAS build page → **Internal Distribution → Install**. Self-contained — no Metro/tunnel.
5. Do NOT run `eas submit` on `development`/`preview` (those are internal builds, not TestFlight).
6. This build is the one later updates reach (Path C) while its native code stays the same.

## Path C — Update (JS-only change to the installed App)

The App checks its channel (`preview` or `production`, eas.json) on launch and runs a new update
from the launch after that. An update reaches only builds whose runtime version, the native
fingerprint (`app.config.js`, `fingerprint.config.js`), equals its own: a change to native code,
a native dependency or the native parts of the config needs a build (Path B) instead.

1. The commit's CI run is completed and green (`gh run list --commit <sha>`): an update installs
   itself, no build or install stands between it and the phone.
2. The server this JS needs is deployed (`docs/sync-design.md` §15, the server ships first): an
   update can outrun a deploy by minutes.
3. Publish with ONE command, from the repo root (never `eas update` directly):
   ```bash
   npm run ios:update                  # or: npm run ios:update -- production
   ```
   Like `ios:app` it needs the clean, pushed tip of a branch and writes and pushes the commit's
   contract snapshot first. Before that it refuses, all reasons at once and leaving no trace, when:
   a variable the App needs is not readable by an update (a `secret` one is not: recreate it as
   `sensitive`, see Env vars); or no finished build of the profile has this native code (the update
   would reach no installed app: build with `npm run ios:app`). Then it bundles from the profile's
   EAS environment alone (never this shell or `.env.local`, always from a cleared Metro cache),
   uploads the source maps to Sentry, and only then publishes to the profile's channel. A failed
   step publishes nothing after it, and the branch is checked out again either way.
4. The phone has it on the launch after the next one (open the App, close it, open it again).

To undo an update, publish a fix forward from a newer commit, never an older commit. Older code
can't be ruled out entirely: when an update crashes at launch, expo-updates falls back to the
build's embedded bundle, and then older code opens a database that newer code migrated. Nothing
tests that direction yet.

## Env vars & secrets (how baking works) — READ if a build "can't reach the server"

Facts (current EAS CLI):

- **`environment` per profile is REQUIRED.** eas.json's build profiles set `"environment"`
  (development/preview/production). Without it, EAS injects **none** of the stored env vars → the app
  builds with `EXPO_PUBLIC_API_URL` undefined → every request fails locally → "Can't reach server"
  and **nothing hits the backend logs**.
- **EAS server vars OVERRIDE eas.json `env`** for the same name. Setting `EXPO_PUBLIC_API_URL` in
  eas.json `env` is silently ignored if a server var of that name exists — fix the server var instead.
- **`EXPO_PUBLIC_API_URL` and `SENTRY_AUTH_TOKEN` are `sensitive`**, not `secret`: a build on the
  EAS worker gets every variable, but an update reads only plaintext and sensitive ones (through
  `eas env:exec` / `eas update --environment`), never `secret` ones, and never this shell or
  `.env.local`. `npm run ios:update` refuses while one isn't readable.
- You can't flip a `secret` to another visibility (`eas env:set` errors): delete it and recreate it
  (`eas env:create --name <NAME> --value <value> --visibility sensitive --environment …`).
- A sensitive value can be read back with `eas env:get`. To verify what a build actually baked,
  download the .ipa and grep:
  `unzip -o app.ipa -d x && strings x/Payload/*.app/main.jsbundle | grep -oE "https://[a-z0-9.-]+/api/v1"`.
- **`SQUIDBOX_APP_BUILD=1`** (plaintext) lives in the preview and production environments, so a
  direct `eas update --environment <profile>` meets app.config.js's snapshot guard too.
- Typical symptom of a wrong baked URL: login works but sync fails, because the URL points at a
  server without `/sync/*`. Check the baked value as above.
- Any `EXPO_PUBLIC_*` var is baked into the binary regardless (that's what `EXPO_PUBLIC_` means);
  keeping it `sensitive` or `secret` only hides it from logs/UI, not from the shipped app. Never put an API key there.

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
- **"Failed to set up credentials / non-interactive mode"** (new bundle id) or **"Provisioning profile
  is not configured correctly. Run this command again in interactive mode"** (expired signing) → run
  `eas credentials:configure-build` interactively via the prompt driver (see above).
- **"Failed to resign build, because it has expired"** → the build artifact is past its ~14-day
  retention. Rebuild instead.
- **Update published but the App doesn't change** → its runtime version differs from the installed
  build's: `eas fingerprint:compare` shows which source differs. Also check the App was opened twice
  while online.
- **Dev client overwrites the App (or vice-versa)** → `EAS_BUILD_PROFILE` wasn't exported, so
  app.config.js fell back to the default bundle id. Confirm it matches the profile passed to `eas build`.

## Security

- Never print or commit the `.p8` contents, Apple password, `EXPO_TOKEN`, or any secret — reference
  env-var NAMES, not values.
- Revocable: ASC key at App Store Connect → Integrations → Team Keys; Expo token at expo.dev → Access
  Tokens. After a session where credentials were shared in chat, advise rotating them.
- Scrub local log/expect files that may have captured credentials (`rm -f *.log *.exp /tmp/2fa_code.txt`).
