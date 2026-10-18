# TODO

Open work, ideas, and steps only the owner can do. Add an entry whenever you discover a problem,
when the owner defers something, or when an idea comes up. Remove an entry once it's done.

## Bugs

## Features

### [ ] Share several assets at once

Nice to have, deferred. Share is only on the asset detail screen (`useShareAsset`); select mode has
none, because `expo-sharing` shares one URL (still so in SDK 58 and on main, no PR or roadmap item)
and React Native's `Share` takes one `url`. Plan: a small local Expo module
(`apps/mobile/modules/share-files`, Expo Modules API, autolinked) whose iOS side presents
`UIActivityViewController(activityItems: urls)` (copy expo-sharing's `SharingModule.swift`,
including the regular-width popover anchor); Android later with `ACTION_SEND_MULTIPLE` and a
FileProvider. A `.web.js` uses `navigator.share({ files })` after `navigator.canShare`, falling back to a
download (Firefox has no file sharing). Web pitfalls: Chromium allows at most 10 files and 50 MB and
rejects `.mov`/`.heic`; the tap's activation lasts about 5 s, so a slower download needs a second
"Share N items" tap. Collect all files first (`useRunWithAssetFiles` with kept downloads), name them
after the asset, and gate the button with `requireOptionalNativeModule`. Skipped
`react-native-share`: no web, slowing releases, config-plugin bugs. Needs a new build. Then remove
our own "Save to camera roll" (`useSaveAssetsToMediaLibrary`, the download buttons): the share sheet's
Save Image / Save Video does it. Check first: it saves without our "Squidbox" album
(`copyToMediaLibraryAsync`), and web has no Save there (the share fallback downloads).

### [ ] Make the app work on Android

The app is built and tested only for iOS. Needed:
- Config: an Android package id with a `.dev` variant like iOS (`app.config.js` switches on
  `EAS_BUILD_PROFILE`), Android settings in the `eas.json` profiles (an APK for internal
  installs) and an EAS-managed keystore.
- Photo access: Android 13+ media permissions and partial access (Android 14) in
  `useAddAssetsFromCameraRoll` and `copyToMediaLibraryAsync`.
- Platform differences: edge-to-edge insets, the back button and gesture (closing modals, the
  viewer, select mode), blur (`expo-blur` is slow or flat on Android: FloatingPill,
  BlurPopoverRenderer, SortFilterModal, AssetQuickViewModal), keyboard events (`AiChatModal`), HEIC
  display.
- Device checks of the gesture-heavy screens: pager, zoom, swipe-up details, drag-select, album
  reorder.
- Pairs with the Android half of "Share several assets at once". Test on an emulator or a phone.

### [ ] Keep the original filename

Imports rename the file to `<id>.<ext>` (`buildAssetAsync.js`) and drop the original name, though the
picker returns it (e.g. `IMG_1234.HEIC`). Store it in a new synced, nullable `originalFilename`
(shared collection schema, client and server migrations; deploy the server before the app sends
it) and show it in the details panel's info block. Older assets stay without it unless the legacy
backups carry names.

### [ ] Share links (like iCloud links)

"Share link" for an asset, a selection or an album: the server stores a share (token, asset ids,
expiry such as 30 days, revocable) and serves a short public link (e.g. `/s/<token>`) to a small web
page that shows the photos and videos and signs fresh S3 download URLs when opened. The app offers
Copy link and Stop sharing. Needs a server table, endpoints and a deploy plus the page. Also covers
sharing several assets, which the share sheet can't do yet.

### [ ] Mouse-friendly triggers on web

Touch gestures map poorly to a mouse: long press to peek, double tap to favorite and drag-select
are awkward with a pointer. When the input is a mouse, offer pointer-native triggers instead, for
example right click (context menu) to peek, hover affordances, and shift/cmd-click to select.
Related: on web a drag-select doesn't cancel the cell's press, so the cell it started on toggles
again after release (`SuperPressable` with `useDragSelect`); natively the pan cancels it.
After a drag reorder (photos in an album, the albums list) the drop also counted as a tap and opened
what it was dropped on; `SortableGrid` now swallows the click that follows a lift, unverified on web.

### [ ] Swipe on to the next photo from a zoomed photo's edge

In Apple Photos, a zoomed photo panned to its left or right edge hands the swipe to the pager. Here
the pager (`AssetPager`, a native `FlatList`) is locked while the photo is zoomed, so you zoom out
first. Handing over mid-touch needs the pager driven from the zoom's pan (e.g. Reanimated `scrollTo`)
or a gesture-handler pager, instead of toggling `scrollEnabled`.

### [ ] Lock the photo pager on the UI thread

A zoom locks the pager through the JS thread (`runOnJS` → `setZoomedAssetId` → `scrollEnabled` in
`AssetPager`), so under JS load a pan right after zooming in can still move the pager. Driving
`scrollEnabled` from a shared value (`useAnimatedProps` on an `Animated.FlatList`) would skip the round
trip, but it's unverified on the phone (Fabric) and react-native-web ignores it, and the swipe-back
lock (`navigation.setOptions`) still needs JS. Try it on a device first.

### [ ] Zoom deeper than the thumbnail

The photo viewer shows the 1000 px thumbnail, so zoom stops at 4× (`useZoomGesture`) and looks soft
well before that. Loading the full-resolution file once zoomed would make deeper zoom worthwhile,
with the maximum taken from the photo's own size.

### [ ] Quick view in albums with custom sort

The long-press quick view is off while drag-to-reorder is enabled (`AlbumAssetsView`). A
long-press held still for about a second could open the quick view, while moving starts the
reorder.

### [ ] Post suggestions: show and open where an asset was posted

In the random suggestions card (`RandomSuggestionsModal`), show when the asset and its album were
last posted, and open the asset detail screen on tap. That screen's swipe-up details
(`AssetDetailsPanel`) already show the asset's albums and every post it is in, each opening it.

### [ ] More AI tools

- Generate a few PPV message texts from a post.
- Quoted RTs, a follow-up tweet with the OF address, and other predefined prompts, for example as
  buttons after a reply.
- Suggest @ mentions from the album's posts, or more generally from the post history.

### [ ] Asset selector in the new design

The Squidbox asset selector (for example "add asset → from Squidbox" when editing a post) still uses
the old design. It should work like the asset and album screens, with search and filter.

### [ ] Recreate thumbnails

An action to regenerate an asset's thumbnail. The video thumbnail in album 197 is broken. The backup
and the tiles already make a missing one again from the original on the device
(`ensureAssetThumbnailAsync`); one whose original is gone too (already backed up) only gets a backup
error, and could be made from the cloud original.

## Design

- **Asset detail background:** a blurred background in the asset's colors.
- **Toolbar:** the floating bars wrap their buttons in a glass pill with padding around them
  (`FloatingPill`, `spacing.barPaddingY`), so a single button, above all the purple one, sits in a
  ring and the bar is taller than its buttons. Instead the bar keeps one height and only groups
  buttons: several sit together with a gap between them, one stands alone without the ring.
  Consider moving the settings button into the toolbar, in a color other than the primary purple.
- **Albums list:** a better layout for name, asset count and last posted.

## Code quality

### [ ] Scan the whole app for duplication

Each look at the asset grids found more copies: the same hooks wired the same way per screen,
private copies of components (`PillButton` twice), hand-styled buttons next to the component that
does it, two screens that were one. Go through `apps/mobile/src` feature by feature (screens,
providers, utils, styles) and merge what repeats into the existing components and hooks, per
AGENTS.md. A copy-paste detector such as [jscpd](https://github.com/kucherenko/jscpd) finds the
literal copies; the near-copies need reading.

### [ ] Widen what CI checks

`.github/workflows/ci.yml` lints only `apps/mobile`; `apps/server` and `packages/shared` have no
ESLint setup. The mobile tests aren't typechecked (`tsconfig.synccheck.json` leaves out `test/`,
which already has type errors, e.g. `twoDevice.e2e.test.ts`). Nothing bundles the app, so a wrong
named import in JS passes until a build (`npx expo export` would catch it).

### [ ] Match the test Postgres to production

CI and `apps/server/docker-compose.yml` run Postgres 16; Neon runs 18 (`db-backup.yml`). Bump both
together; an existing local compose volume needs a dump and restore (or a fresh volume).

### [ ] CI depends on ngrok's CDN

`npm ci` runs ngrok's postinstall, which downloads its binary on every run and fails the install
when the download fails. CI doesn't need it. Make `ngrok` optional or skip its script in CI.

### [ ] One vertical drag per asset page

The photo's drag (`verticalDrag` in `useZoomGesture`) and the details panel's own pan
(`useDetailsPanelDrag`) feed the same track as two gestures. One page-level vertical Pan in
`AssetPage` would be simpler; it needs device testing against the zoom, the pager and the rows.

### [ ] Rewrite the app in TypeScript

The app is mostly JavaScript (`.js` / `.jsx`); only `src/sync` is TypeScript, and only that part
is typechecked (`npm run typecheck`). Convert the rest gradually, feature by feature, and widen
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

### [ ] iPhone simulator smoke tests in the cloud

Run Maestro flows on an iOS simulator with EAS Workflows (a simulator build profile in `eas.json`,
`.eas/workflows/*.yml`, a `type: maestro` job) before each preview build: open a photo, zoom,
swipe, open a post's photo, share. Catches iPhone-only crashes the web preview misses (like the
worklet-capture and post-photo crashes). Needs a test account with a few photos on the live backend
(login as an EAS secret, since the cloud can't reach the local mock backend) and costs EAS build
time per run. Can't check gestures' feel or sharing to other apps.

### [ ] Smaller data-layer costs

Measured as worth little today, so left open: every statement is prepared and
finalized again (`db/expoExecutor.ts`; a statement cache saves two native calls each); the pull
fetches the next pages only after applying the last batch (`worker.ts` `pullPhase`; prefetching one
page overlaps network and writes).

### [ ] Measure WAL on iOS

`db/client.ts` sets no journal mode (expo-sqlite sets none either). With one connection and the
FIFO queue, WAL adds no read concurrency, so take it only if a measured write-latency win on a
device justifies an iOS-only setting (web's OPFS storage measured slower with WAL).

### [ ] Investigate everything the app stores on the phone

The app promises not to clutter the phone's storage, so check every place it writes and whether
each is cleaned up: originals of uploaded assets (`assetFiles`, kept after upload?), thumbnails,
cloud downloads for Save/Share (cache, swept after an hour), each library's SQLite database and
WAL, parked libraries (see below), the image and video players' caches, the picker's and the
thumbnail makers' temporary copies (`pickImageFromMediaLibrary`, `createImageThumbnail`,
`createVideoThumbnail`) and whatever a crash or kill leaves mid-write. Outcome: a list of what
stays and why, fixes for leaks, and maybe a Settings view of the space used with a "Free up space"
action.

### [ ] Free the space used by other accounts' cached libraries

Parked libraries stay on the phone forever: signing in as another account parks the current
library (`src/library/switchLibrary.ts`) and nothing in the UI removes one since "Libraries on this
iPhone" went (`removeLibrary` now only serves the merge). Rare, multi-account only; a Developer or
Settings action behind a recount of the parked database would do, and it must keep or warn about
originals that aren't uploaded yet.

### [ ] Find duplicates by content when the device library joins an account

The sign-in merge (`src/library/mergeLibrary.ts`) only spots a camera-roll photo the account already
holds if this phone's account library pulled it before. A content hash per asset would catch the
rest. Only worth it if duplicates show up in practice; a wrong match would hide a distinct photo.

### [ ] A library handle that owns its database, paths and caches

About 15 helpers in `src/utils/assets` default a `library` argument to `getLibrary()` (the open
library), and every long flow (a backup run, a merge, a camera-roll add) captures the library itself
so a late write lands in the right one. A handle provided from `LibraryGate` that owns the
database, the paths and the thumbnail caches would drop those defaults and the captures. A larger
refactor; today's defaults work.

### [ ] Resolve a converted install's null serverId/userId once at boot

An install converted before its first `/me` carries `serverId: null` (and a session may carry
`userId: null`), and `sameAccount`, `libraryForSession`, `resolveOwner` and `rebuildRegistry`
each handle that case. Resolving it once at boot (after `/me`) would let `sameAccount` be strict
(same user on the same server, no null wildcard) and remove the special cases from the others.

### [ ] Concurrent edits from two devices overwrite each other

Sync resolves conflicts per record by last writer wins (`apps/server/src/sync/push.ts`): editing the
same album or post on two devices before either syncs keeps only the later edit, silently. Fine for
one person on one phone; per-field merge would fix it if it bites.

### [ ] Web preview gaps

The web preview (README → "Web preview") can't add photos from the camera roll, upload, download
files or pinch. Web versions exist only for tokens and thumbnails. Extend them if testing those
flows in the browser becomes worth it. The photo viewer also doesn't follow a scroll on web:
react-native-web's ScrollView never fires `onMomentumScrollEnd`/`onScrollEndDrag`, so
`AssetPager` never learns the new page (header, actions, notes and the swipe-up details stay on the
first photo, and only that photo zooms). The mock data has no video, and Playwright's Chromium can't decode H.264 or HEVC,
so only a WebM plays in the preview (an iPhone's HEVC `.mov` may not play in desktop Chrome either).

### [ ] Sentry receives events from development

`Sentry.init` in `App.js` is always on, so the dev client and the web preview report into the
production project. Consider `enabled: !__DEV__`.

### [ ] One animation library

Animations use both React Native's `Animated` and Reanimated. Move the `Animated` ones
(`BlurPopoverRenderer`, `SortFilterModal`, `MainTabNavigator`, `AssetImage`, `AiChatModal`) to
Reanimated, so everything runs on the UI thread with one API.

### [ ] One sync for data and files

Records sync on their own (`sync/worker.ts`, the outbox) while files upload in a separate, manual
backup run (`sync/backupRun.ts`), each with its own errors and Retry All (Sync and Backup screens).
Consolidate into one procedure that syncs data and files together, automatically in the background,
with one status and one error list. Until then a photo added on one device shows on the others with
no picture ("Still uploading from your other device.") until someone taps "Back up now" there. The
owner wants this later, not now.

### [ ] Keep upload failures out of the synced assets table

Upload failures (`syncError`) are the one local-only field, on the synced `assets` table. Move them
into a local `sync_failures` table: that drops the `localOnly` descriptor machinery
(`packages/shared/collections/define.ts`, `localOnlyKeys.ts`, the stripping in `outbox.ts` and
`upsertRows.ts`, the reset in `mergeLibrary.ts`).

### [ ] Backup doesn't say why it skips an asset whose push failed

The backup run skips assets with an outbox row (`backupRun.ts` `isUnconfirmed`), so their originals
aren't deleted before the server has their record. The Backup screen still counts them as "N not
backed up" with no hint why: a failed push is listed on the Library sync screen, and a pending one
(an import right before Backup) needs another run. Backup could wait for the push first.

### [ ] Worklet capture check in CI

A worklet that reads a captured binding in a default parameter, or calls a plain (non-worklet)
function on the UI thread, only fails at runtime on the phone. A script could catch it: run the
`react-native-worklets` Babel plugin over `src/`, find each generated worklet factory, read its
`__closure` names, and flag those used in parameter defaults or bound to a plain function, a
React hook result or an unresolved import that the worklet calls. An audit prototyped this
(unpolished, with hard-coded paths); make it a `scripts/checkWorklets.mjs` run by `npm run lint`.

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
