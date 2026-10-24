# TODO

Open work, ideas, and steps only the owner can do. Add an entry whenever you discover a problem,
when the owner defers something, or when an idea comes up. Remove an entry once it's done.

## Bugs

### [ ] The quick view stayed open once

The owner's long-press preview (`AssetQuickViewModal`) once stayed up after the finger lifted, on the
dev client. A tap now closes it, but the cause isn't confirmed. Likeliest: the quick view is a
native `Modal`, which can take the touch from the cell under it, so the cell's press-out
(`onLongPressOut`) never comes. An overlay inside the screen (`pointerEvents="none"`) would leave
the touch with the cell. Check on a phone.

## Features

### [ ] Search suggestions as you type, like Apple Photos

Wanted by the owner, later. While typing in a list's search (`SearchOptionsBar`), show a menu of
matching terms above the field, each with how many assets it finds (Apple Photos: "mvp 3",
"mvz 1"). Terms would come from the words of the assets' notes, which is what `assetQuery` searches.

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
  BlurPopoverRenderer, AssetQuickViewModal), keyboard events (`AiChatModal`), HEIC
  display.
- Device checks of the gesture-heavy screens: pager, zoom, swipe-up details, drag-select, album
  reorder.
- Pairs with the Android half of "Share several assets at once". Test on an emulator or a phone.

### [ ] Show the recorded photo details

Assets now record `favoritedAt`, `takenAt`, `originalFilename`, `latitude` and `longitude`
(sync-design §10), but nothing shows or sorts by them yet. Ideas: the original name and place in
the details panel's info block, a Newest/Oldest by capture date like Apple's, a Recently favorited
sort. Older assets have none of them unless the camera roll or the legacy backups still do.

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

### [ ] Zoom deeper than the thumbnail

The photo viewer shows the 1000 px thumbnail, so zoom stops at 4× (`useZoomGesture`) and looks soft
well before that. Loading the full-resolution file once zoomed would make deeper zoom worthwhile,
with the maximum taken from the photo's own size.

### [ ] Remove deleted items for good after 30 days

Like Apple Photos: an item in the Deleted album is removed for good 30 days after it was deleted,
and each tile shows the days left (`DeletedAssetsAlbum`). Today it stays until "Delete permanently".
Best run on the server (a daily job purging assets deleted 30+ days ago, then the file cleanup), so
it works with no device open and can't clash with a restore made on another device.
Possible paid tier later: 3 days' retention by default, 30 days for paying users.

### [ ] Context menus on long press (photo, album, post)

Apple-Photos-style menu on long press: a preview with actions such as Share, Save, Add to album,
Favorite, Delete. Build it in JS: the existing quick view (`AssetQuickViewModal`) with a menu from
`components/popup-menu-options` under it, opened from the grids' "hold still" step (`onPeek` in
`components/sortable-grid/useDragReorder.js`), so moving the finger still closes it and drags, as in
Photos, and it works on web. Unlike today's quick view, the menu stays open after the finger lifts.
Native menus were checked: `@expo/ui` `ContextMenu` ships with the SDK but is iOS only and takes the
touch, so drag-to-reorder can't follow it (fine later for screens that don't drag, like a post);
`zeego` and `react-native-ios-context-menu` would make SDK upgrades harder.

### [ ] AI assistant rework

Where AI is needed:
- Create a PPV message from an existing post, for sending the post as a PPV.
- Create fresh ideas from an existing post, for reposting.
- Create a follow-up tweet with the OnlyFans URL. Also quoted RTs and other predefined prompts, for
  example as buttons after a reply.
- Suggest @ mentions from the album's posts, or more generally from the post history.
- The post suggestions (`features/ai-suggestions`) work well but have no idea what's in the pictures,
  so caption suggestions don't always fit.

General ideas:
- **One assistant** for all these use cases, with a similar interface where possible, so it can also
  cover other use cases users might have.
- **Onboarding with a persona.** The user creates a persona so the assistant writes content that
  fits their content and tone.
- **Know what the content is about.** Image recognition of the user's media, and it must be very
  specific: for the owner's media, tags like blowjob, deepthroat, facefuck, throatfuck, etc. Let the
  user also enter tags for what their content is about, and set how detailed or broad to be about a
  topic.
- **Favorite suggestions** to teach the assistant which style and tone the user prefers.
- **Memory.** What the user tells the assistant is remembered, e.g. "make it more about the action
  and less about the filming", "less influencer style, more guy next door".
- **The AI screens aren't on the design system yet** (`AiChatModal`, `RandomSuggestionsScreen`,
  `ModelSelectorButton`). They were left out of the component and token rework: they use the new
  color and type tokens, but their sizes, paddings and radii are still literals (chat bubbles, send
  and arrow buttons, the model sheet), their inputs and buttons are hand-built, and
  `ModelSelectorButton` draws its own divider and sheet instead of `ListDivider` and the shared
  popovers. Redo them on the shared components with the assistant rework.

### [ ] Alternative texts for a post

Save variations of a post's text for a different audience or purpose, e.g. when it's sent as a PPV
or posted on another platform.

### [ ] Recreate thumbnails

An action to regenerate an asset's thumbnail. The video thumbnail in album 197 is broken. The backup
and the tiles already make a missing one again from the original on the device
(`ensureAssetThumbnailAsync`); one whose original is gone too (already backed up) only gets a backup
error, and could be made from the cloud original.

## Design

- **Asset detail background:** a blurred background in the asset's colors.
- **Albums list:** a better layout for name, asset count and last posted.
- **Toolbar look.** The owner isn't fully happy with the toolbars yet (2pt frame, settings avatar
  outside the header pill) but has no better idea for now. Tried and dropped: a 3pt frame with the
  avatar inside the pill. Revisit when an idea comes up.
- **Dark mode.** The tokens are ready for it (`colors` are semantic roles over a private `palette`
  in `styles/designTokens.js`), but there is no dark set yet: add one and pick it with
  `useColorScheme`, then check the screens that hard-code white (the octopus art).
- **Tokens left to do.** Paddings and gaps are still literals (a 4 pt `spacing` scale would cover
  most), and `typography` and `lineHeights` are paired by hand at each call site; composite text
  styles (`{ fontSize, lineHeight }`) would keep them in step.

## Code quality

### [ ] Bump INSTALLED with each preview build

`INSTALLED` in `apps/mobile/test/mainClient.e2e.test.ts` is the commit of the preview build on the
owner's phone (b8171cf): move it to the new build's commit whenever a preview build is installed, so
the suite tests the real upgrade path.

### [ ] Drop the outbox's whole-record rows

`outbox.whole_record` (`sync/db/schema.ts`, the `fields` it leaves out in `sync/worker.ts`) exists
only for rows queued by a build before per-field sync (0011_outbox_fields). The phone is past it
and mainClient.e2e no longer covers it: a migration can drop the column once no such row can be left.

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

The photo's drag (`verticalDrag` in `useZoomGesture`) and the details panel's pan
(`useDetailsPanelDrag`) feed one track as two gestures. Merging them into one page-level pan was
tried and left: it needs checks on where each touch lands (catching the panel, a zoomed photo with
the details open), zoom state passed up to `AssetPage`, and new relations with the nested zoom
gestures, which only a phone can test. Revisit only if the two drift apart.

### [ ] Rewrite the app in TypeScript

The app is mostly JavaScript (`.js` / `.jsx`); only `src/sync` and `src/library` are mostly
TypeScript, and only their `.ts` files are typechecked (`npm run typecheck`). Convert the rest gradually, feature by feature, and widen
the typecheck to the whole app.

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

The sign-in merge (`src/library/mergeLibrary.ts`) matches a photo the account already holds by its
camera-roll id, after the account library's first full pull (every merge waits for it). A photo whose
camera-roll id differs (imported on another device, or re-saved) still comes in twice. A content hash
per asset would catch those. Only worth it if duplicates show up in practice; a wrong match would hide
a distinct photo.

### [ ] Web preview gaps

The web preview (README → "Web preview") can't add photos from the camera roll, upload, download
files or pinch. Web versions exist only for tokens and thumbnails. Extend them if testing those
flows in the browser becomes worth it. The photo viewer also doesn't follow a scroll on web:
react-native-web's ScrollView never fires `onMomentumScrollEnd`/`onScrollEndDrag`, so
`AssetPager` never learns the new page (header, actions, notes and the swipe-up details stay on the
first photo, and only that photo zooms). Playwright's Chromium can't decode H.264 or HEVC, so the
mock videos (H.264) don't play in the preview; only a WebM would (an iPhone's HEVC `.mov` may not
play in desktop Chrome either). The post editor's date and time pills (`DateTimePicker`) render clipped
("23," / "10:5 AM").

### [ ] Sentry receives events from development

`Sentry.init` in `App.js` is always on, so the dev client and the web preview report into the
production project. Consider `enabled: !__DEV__`.

### [ ] One animation library

Animations use both React Native's `Animated` and Reanimated. Move the `Animated` ones
(`BlurPopoverRenderer`, `MainTabNavigator`, `AssetImage`, `AiChatModal`) to
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

### [ ] Database and caches through the library handle too

Only the asset path helpers lost their `getLibrary()` fallback. `AppInit` still builds the sync target
from `getDb()`/`getLibrary()`, `switchLibrary` uses `getLibrary()`, and the web thumbnail cache is
module-global. Closing a library already makes a late write fail, so this is tidiness, not safety.

### [ ] A parked device library says nothing outside the first sync

The setup screen says this iPhone's photos join after the first sync (`FirstSyncScreen`), but a
device library whose merge failed (it retries at each boot, `mergeDeviceLibrary`), or that waits for
another library or account it joined (`joinedElsewhere` in `library/mergeMarker.ts`), shows nothing in
the app, so its photos are out of sight until it completes. Show it in the sync status or Settings.

### [ ] Tell the user when this iPhone's library won't open

A device library whose database won't open (a failed migration, a damaged file) is passed over
silently: `openLibraryForSession` opens the session's own library instead, and the setup screen still
says this iPhone's photos join after the first sync. Say that its photos can't be opened, and how
to get help.

### [ ] A merge waits for its target's push; a rejected row holds it

`mergeLibrary` (`src/library/mergeRun.ts`) removes the device library only once the account's library
has no outbox row left up to the newest at the merge's commit (`isPushed`, sync-design §8). A row the
server keeps rejecting (too large, invalid) holds the device library parked, with nothing said in the
app, whether the merge wrote it or it was an older failed row of the account's. Its data is safe
there; show it, or let the merge finish past a rejected row.

### [ ] Merge marks are one JSON value per source library

`mergeMarks:<source>` (`sync/status.ts`) holds a decision per merged record in one `sync_meta` value,
read and written whole by every pass: about 100 bytes per record, so ~1 MB for a 10,000-photo device
library. Fine for a few passes; a table keyed by record would scale if passes get frequent.

### [ ] Make the dev secrets work in cloud environments, not just on a laptop

`scripts/dev-local.mjs`, `apps/mobile/scripts/check-env.sh` and CLAUDE.md treat
`apps/mobile/.env.local` as the only source of the `EXPO_PUBLIC_*` values; a cloud environment
exports them as variables, and the scripts refuse to start. Owner request. Research first what to
use (variables with the file as a laptop fallback, EAS environment variables, a secret manager), then
change the scripts and CLAUDE.md together.

### [ ] `albumId` post scope and `albumLastPostedAt` count deleted albums' edges

`postQuery`'s `albumId` scope and `albumLastPostedAt` (`sync/assetSql.ts`) use
`liveAlbumAssetIds`, which checks the edge's deletion but not the album's, while the
`sharesAlbumWithPostId` scope and `albumQuery` exclude deleted albums. Harmless today (a deleted
album's screen isn't opened), but one rule would be cleaner. With it, have `postQuery`'s `albumId`
scope watch `schema.albums` as `sharesAlbumWithPostId` does, so both refresh when an album is
deleted or restored.

### [ ] Cap the post screen's Other Posts

Other Posts on the post screen (`features/post-detail/Post.jsx`, `PostRows`) reads the whole post
history of the post's albums into a `ScrollView`, as the photo details do for an asset's posts. If
an album with hundreds of posts makes the screen slow, show the latest few (e.g. 10) and a row that
opens the album's Posts tab (`AlbumPostsView`).

## Ideas

- **Backup progress ring.** The Backup screen shows a running backup as "sent / total" text.
  `components/ProgressRing` (now a shared component, used by the progress overlay) could show it
  there too. Owner to decide.
- **Background sync.** Sync runs only while the app is open. A background task or a silent push
  from the backend could keep the library fresh. Owner asks: real background sync via a native
  module?
- **Thumbnail backfill.** Thumbnails load lazily, so one you never scrolled to is blank offline.
  A low-priority background backfill after the first sync would close that gap, using the existing
  queue's concurrency cap. Decide first: Wi-Fi only (recommended), any network, or stay lazy.
- **Server env precedence.** `node --env-file` never overrides variables already in the shell, so
  exported AWS credentials silently win over `apps/server/.env`. `npm run dev:local` strips them;
  plain `npm run dev` in `apps/server` doesn't. Loading `.env` with override semantics for local
  runs would remove the pitfall.

## Owner-side (needs a device, infra or secrets)

### [ ] Renew iOS signing before Oct 10, 2027

The distribution certificate and both ad hoc profiles expire then, and installed apps stop opening.
Renew them via the **`/build`** skill (see "expired signing" there) a few weeks ahead.
