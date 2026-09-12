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
</content>
