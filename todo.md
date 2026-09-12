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
</content>
