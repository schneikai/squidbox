# TODO — remaining user-side items

The Rails→TypeScript + multi-device-sync migration is **complete and deployed** (see
`docs/migration/STATUS.md`). No code work remains — only these user-side steps that need a
device, a real deploy check, or infra/secrets access. Remove an item once it's done.

## [ ] Build a real Dev Client

"Squidbox Dev" needs a rebuild to include the `expo-sqlite` native module (added during the sync
migration; `runtimeVersion` was bumped). Build it via the **`/build`** skill (choose **Dev
Client**), then install it on a physical device and confirm the app launches (SQLite migrates) and
the initial library sync completes.

## [ ] Test a photo upload

Against the deployed backend (`squidbox-server` on Fly.io), take/upload a photo and confirm the
file lands in S3 and the asset syncs. Server-proxied streaming upload path
(`assets/upload/*`) — the one flow best confirmed on a real device.

## [ ] Retire the old Rails droplet

Once the new backend is confirmed working end-to-end, decommission the old DigitalOcean Rails
droplet (the legacy library has already been imported — see `/legacy-import`).

## [ ] Rotate the AWS keys

Rotate any AWS access keys that were pasted into terminals/chats during deploy + legacy import —
treat them as exposed.

## [ ] Thumbnail background backfill (deferred enhancement + decision)

Thumbnails now load **lazily** — only cells scrolled into view download (bounded queue in
`AssetThumbnailLoaderProvider`). This is safe and fast, but a thumbnail you've never scrolled to
won't be on-disk, so it'd be blank if viewed **offline**. To close that gap, add a low-priority
**background backfill**: after the first sync completes and the app is idle, trickle through all
missing thumbnails using the same concurrency cap, always yielding to on-screen (priority)
requests. The queue is already built to take this as a second tier.

Decision needed first (data/battery tradeoff for a ~14k-thumbnail library):
- **Wi-Fi only** (recommended) — full offline coverage without burning cellular data (needs a
  network-type check).
- **Any network** — fastest coverage, but uses mobile data.
- **Leave lazy-only** — accept the rare offline gap.

## Monorepo dependency hygiene (reference — expo-doctor is 20/20 as of the SDK-55 alignment)

If `expo-doctor` ever flags version drift again, do NOT run `expo install --fix` (or any
`npm install`) from `apps/mobile/` — in this npm-workspaces monorepo that half-bumps only the app
and leaves old versions hoisted at the workspace root (duplicate native modules), which then won't
dedupe. Instead: set the target versions in `apps/mobile/package.json`, then do ONE clean root
install — `rm -rf node_modules apps/*/node_modules packages/*/node_modules package-lock.json && npm
install` from the repo root — which resolves to a single coherent tree. Then rebuild the dev client.

`@sentry/react-native` is intentionally pinned to **8.x** (see `expo.install.exclude` in
apps/mobile/package.json): 8.x has the React 19 / New Architecture support SDK 55 needs; Expo's
doctor pin to ~7.11 is stale and re-breaks the build (it was bumped to 8.x in a1ae366).
</content>
