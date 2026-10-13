# TODO

Open work, ideas, and steps only the owner can do. Add an entry whenever you discover a problem,
when the owner defers something, or when an idea comes up. Remove an entry once it's done.

## Bugs

### [ ] "Resort albums by name" is undone by the next sync

The tool (`useResortAlbumsByName.js`) reorders albums by rewriting their `createdAt`, but the server
treats `createdAt` as immutable (`updatableColumns` in `apps/server/src/sync/collections.ts`): the
push reports applied, and the next pull brings the old dates back. Decide: give albums a real sort
field, or let the server accept `createdAt` changes.

### [ ] Make "Delete permanently" actually delete

In the Deleted album, "Delete permanently" (`deleteAssetsAsync`) only tombstones the assets again.
They stay in the Deleted album, and their files stay in S3. It should delete the S3 file and
thumbnail through `POST /assets/delete` and remove the records for good.

### [ ] Remove local files when a delete arrives through sync

When another device deletes an asset, this device applies the tombstone but keeps its local file
and thumbnail. See `docs/sync-design.md` §7a.

### [ ] Uploads during an account switch

A file upload that is in flight while another account signs in can retry with the new session
and leave an orphaned file in that account's storage. Rare and harmless to metadata.

### [ ] AI chat corrections misbehave

Asking for corrections sometimes returns a single post instead of variations, and replies sometimes
contain raw markup such as JS array notation.

### [ ] Drag-select in the system photo picker moves the screen sideways

In the system picker (camera roll), tap-and-drag to select makes the whole screen move left and
right. The picker is native, so check what the app can influence through its options.

## Features

### [ ] Mouse-friendly triggers on web

Touch gestures map poorly to a mouse: long press to peek, double tap to favorite and drag-select
are awkward with a pointer. When the input is a mouse, offer pointer-native triggers instead, for
example right click (context menu) to peek, hover affordances, and shift/cmd-click to select.

### [ ] Video playback

Videos don't play: the detail screen shows only the duration (`VideoControls`). `expo-video` is
already installed.

### [ ] Asset details on swipe up

On the asset detail screen, swipe up (as in Apple Photos) to see details: the albums the asset
belongs to and when it was last posted.

### [ ] Zoom like Apple Photos

Pinch currently springs back and always scales from the center (`AssetItem`). Zoom should center
on the pinch or tap point, stay zoomed and allow panning, with the pager locked while zoomed. The
fullscreen view on the asset detail screen needs the same.

### [ ] Quick view in albums with custom sort

The long-press quick view is off while drag-to-reorder is enabled (`AlbumAssetsView`). A
long-press held still for about a second could open the quick view, while moving starts the
reorder.

### [ ] Post suggestions: show and open where an asset was posted

Show when the asset and its album were last posted, and allow going to the album (or to the asset
detail screen on tap).

### [ ] Save posts for later / drafts

Keep a generated caption without posting it now, for example as a draft post. Posts without a
`postedAt` already exist and sort separately, so drafts can build on that.

### [ ] More AI tools

- Generate a few PPV message texts from a post.
- Quoted RTs, a follow-up tweet with the OF address, and other predefined prompts, for example as
  buttons after a reply.
- Suggest @ mentions from the album's posts, or more generally from the post history.

### [ ] Asset selector in the new design

The Squidbox asset selector (for example "add asset → from Squidbox" when editing a post) still uses
the old design. It should work like the asset and album screens, with search and filter.

### [ ] Recreate thumbnails

An action to regenerate an asset's thumbnail. The video thumbnail in album 197 is broken.

## Design

- **Asset detail background:** a blurred background in the asset's colors.
- **Toolbar:** no outer pill when it holds a single button. Consider moving the settings button
  into the toolbar, in a color other than the primary purple.
- **Albums list:** a better layout for name, asset count and last posted.

## Code quality

### [ ] Scan the whole app for duplication

Each look at the asset grids found more copies: the same hooks wired the same way per screen,
private copies of components (`PillButton` twice), hand-styled buttons next to the component that
does it, two screens that were one. Go through `apps/mobile/src` feature by feature (screens,
providers, utils, styles) and merge what repeats into the existing components and hooks, per
AGENTS.md. A copy-paste detector such as [jscpd](https://github.com/kucherenko/jscpd) finds the
literal copies; the near-copies need reading.

### [ ] Run lint, tests and knip in CI

The only workflow is `db-backup.yml`; nothing checks a push. A GitHub Actions job running
`npm run lint`, the mobile and server tests and `npm run knip` would catch regressions before they
land. `src/obsolete-code` stays out of knip on purpose (a kept drawer of old code).

### [ ] Rewrite the app in TypeScript

The app is mostly JavaScript (`.js` / `.jsx`); only `src/sync` is TypeScript, and only that part
is typechecked (`npm run typecheck:sync`). Convert the rest gradually, feature by feature, and widen
the typecheck to the whole app.

### [ ] Share models between backend and app

`packages/shared` already defines the synced records (Zod collections) and the API contracts, and
both sides use them. The app still keeps its own older Yup schemas (`src/utils/*/*Schema.js`, used
by the album and post providers, `buildAssetAsync` and the post screens) and adapter code
(`src/sync/legacyAsset.ts`, `legacyBase.ts`). Replace those with the shared types so each model is
defined once.

### [ ] Add UI tests

Only pure logic is tested (`apps/mobile/test`, vitest in Node). Set up component tests (for
example jest-expo with React Native Testing Library) and cover the key screens first: the photo
detail pager, login and sign-out, and the library grid. Consider end-to-end tests (for example
Maestro) for the main flows later.

### [ ] Read lists page by page from SQLite

The providers still load whole tables (assets, album edges, posts) into memory on every launch,
so startup grows with the library (~5.8 s to the first grid at 50k on web). Plan, reviewed and
ready to build: `docs/paged-reads-plan.md`.

### [ ] Check a 50,000-asset library on a device

The data layer was tuned on the web preview (`npm run seed:mock -- --assets 50000`): a favorite
toggle costs ~0.2 s of main-thread work there, a pull of 1,000 remote changes ~0.3 s, and the first
sync ~40 s (web storage is slow; the change-log triggers double the write cost). Measure the same on
an iPhone with the dev client.

### [ ] Smaller data-layer costs

Measured as worth little today, so left open: the driver notifies live reads even when a write
changed no rows (`db/driver.ts`; expo's `changes` would tell); every statement is prepared and
finalized again (`db/expoExecutor.ts`; a statement cache saves two native calls each); the pull
fetches the next pages only after applying the last batch (`worker.ts` `pullPhase`; prefetching one
page overlaps network and writes).

### [ ] Push failures of albums and posts only show in the sync log

A rejected or unappliable push result flags assets with `syncError` (shown in the sync error
viewer), but albums, posts and their edges have no such field (`worker.ts` `applyPushResults`).
Their outbox rows retry on every sync and the failure is only visible in the Sync Inspector's log.

### [ ] Start cloud init while the database opens

`AppInit` sits inside `DatabaseGate` (`App.js`), so the splash waits for opening and migrating the
database, then for `initializeCloudAsync`. Running both at once would shorten launch a little.

### [ ] Upload a photo's file and thumbnail at once

The upload loop (`CloudSyncProvider.js`) uploads the file, then the thumbnail, and writes the
asset twice (`isFileSynced`, then the rest). Uploading both at once (`Promise.allSettled`) and
writing the flags in one `updateAsset` halves the waits and the writes per photo.

### [ ] Web preview gaps

The web preview (README → "Web preview") can't add photos from the camera roll, upload, download
files or pinch. Web versions exist only for tokens and thumbnails. Extend them if testing those
flows in the browser becomes worth it.

### [ ] Sentry receives events from development

`Sentry.init` in `App.js` is always on, so the dev client and the web preview report into the
production project. Consider `enabled: !__DEV__`.

### [ ] One animation library

Animations use both React Native's `Animated` and Reanimated. Move the `Animated` ones
(`BlurPopoverRenderer`, `SortFilterModal`, `MainTabNavigator`, `AssetImage`, `AiChatModal`;
`AssetItem` goes with the zoom rework) to Reanimated, so everything runs on the UI thread with one API.

### [ ] Move off Node 20

Node 20 reached end of life in April 2026. `mise.toml` pins 20.19.4 and the server image uses
`node:20-slim`. Move both to the current LTS and run the tests.

## Ideas

- **Background sync.** Sync runs only while the app is open. A background task or a silent push
  from the backend could keep the library fresh.
- **Thumbnail backfill.** Thumbnails load lazily, so one you never scrolled to is blank offline.
  A low-priority background backfill after the first sync would close that gap, using the existing
  queue's concurrency cap. Decide first: Wi-Fi only (recommended), any network, or stay lazy.
- **Mock videos.** `npm run seed:mock` creates photos only. Adding a few short videos would cover
  the video player and controls.
- **Server env precedence.** `node --env-file` never overrides variables already in the shell, so
  exported AWS credentials silently win over `apps/server/.env`. `npm run dev:local` strips them;
  plain `npm run dev` in `apps/server` doesn't. Loading `.env` with override semantics for local
  runs would remove the pitfall.

## Owner-side (needs a device, infra or secrets)

### [ ] Test a photo upload

Against the deployed backend (`squidbox-server` on Fly.io), take/upload a photo and confirm the
file lands in S3 and the asset syncs. The server-proxied streaming upload (`assets/upload/*`) is
the flow best confirmed on a real device.

### [ ] Retire the old Rails droplet

The old Rails server still runs on a DigitalOcean droplet. Its library is already in the backend.
Decommission the droplet once the photo upload test passes.

### [ ] Rotate credentials shared in chats

Treat these as exposed and rotate them:

- AWS access keys used for deploying and the legacy import.
- From the October 2026 build sessions: the Expo access token, the App Store Connect API key, the
  ngrok authtoken, the OpenAI API key, the Docker Hub password, and the Squidbox account password.
  Update `.env.local`, the password manager, and EAS (`EXPO_PUBLIC_OPENAI_API_KEY`) afterwards.

### [ ] Renew iOS signing before Oct 10, 2027

The distribution certificate and both ad hoc profiles expire then, and installed apps stop opening.
Renew them via the **`/build`** skill (see "expired signing" there) a few weeks ahead.

### [ ] Check the photo detail view on a device

Photos in the detail view may be slightly cropped. Confirm or rule it out.
