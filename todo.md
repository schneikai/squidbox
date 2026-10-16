# TODO

Open work, ideas, and steps only the owner can do. Add an entry whenever you discover a problem,
when the owner defers something, or when an idea comes up. Remove an entry once it's done.

## Bugs

### [ ] Make "Delete permanently" actually delete

In the Deleted album, "Delete permanently" (`deleteAssetsAsync`) only tombstones the assets again.
They stay in the Deleted album, and their files stay in S3. It should delete the S3 file and
thumbnail through `POST /assets/delete` and remove the records for good.

### [ ] Remove local files when a delete arrives through sync

When another device deletes an asset, this device applies the tombstone but keeps its local file
and thumbnail. See `docs/sync-design.md` §7a.

### [ ] AI chat corrections misbehave

Asking for corrections sometimes returns a single post instead of variations, and replies sometimes
contain raw markup such as JS array notation.

### [ ] Drag-select in the system photo picker moves the screen sideways

In the system picker (camera roll), tap-and-drag to select makes the whole screen move left and
right. The picker is native, so check what the app can influence through its options.

### [ ] The web preview's library limit shows as a generic sign-in failure

The browser holds about three parked libraries (`docs/library-ownership-plan.md` §1.8 promised
"This browser can't hold more libraries…"); today a fourth sign-in surfaces as `LoginForm`'s
"Authentication failed!" with "Couldn't create the library: …" (`switchLibrary.ts`). Only matters
when the web preview signs into several accounts.

## Features

### [ ] Drag to reorder albums

The albums list has a synced custom order (`albums.position`, the default sort), but the only way to
set it is the "Sort albums by name" tool in Settings. Dragging albums in the list, like photos in an
album (`SortableAssetGrid`, `edges.reorder`), would write the same positions.

### [ ] Mouse-friendly triggers on web

Touch gestures map poorly to a mouse: long press to peek, double tap to favorite and drag-select
are awkward with a pointer. When the input is a mouse, offer pointer-native triggers instead, for
example right click (context menu) to peek, hover affordances, and shift/cmd-click to select.
Related: on web a drag-select doesn't cancel the cell's press, so the cell it started on toggles
again after release (`SuperPressable` with `useAssetDragSelect`); natively the pan cancels it.
The same happens after a drag reorder in an album: the drop also counts as a tap and opens the
photo viewer (`SortableAssetGrid` with `useAssetDragReorder`).

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

### [ ] Check a 50,000-asset library on a device

The data layer was tuned on the web preview (`npm run seed:mock -- --assets 50000`): a favorite
toggle costs ~0.2 s of main-thread work there, a pull of 1,000 remote changes ~0.3 s, and the first
sync ~40 s (web storage is slow). Measure the same on
an iPhone with the dev client.

### [ ] Smaller data-layer costs

Measured as worth little today, so left open: every statement is prepared and
finalized again (`db/expoExecutor.ts`; a statement cache saves two native calls each); the pull
fetches the next pages only after applying the last batch (`worker.ts` `pullPhase`; prefetching one
page overlaps network and writes).

### [ ] Push failures of albums and posts only show in the sync log

A rejected or unappliable push result flags assets with `syncError` (shown in the sync error
viewer), but albums, posts and their edges have no such field (`worker.ts` `applyPushResults`).
Their outbox rows retry on every sync and the failure is only visible in the Sync Inspector's log.

### [ ] Measure WAL on iOS

`db/client.ts` sets no journal mode (expo-sqlite sets none either). With one connection and the
FIFO queue, WAL adds no read concurrency, so take it only if a measured write-latency win on a
device justifies an iOS-only setting (web's OPFS storage measured slower with WAL).

### [ ] Throttle the albums stats re-read during uploads

While the Albums tab is focused, `albumQuery.page` re-runs on every write to its five tables. A
backup run writes each asset twice, so the list re-reads its stats (175–440 ms native) per
uploaded asset. Coalesce its re-reads to about one per second (`useAlbumRows` / `watchQuery`).

### [ ] Skip a stopped watch's queued read

`watchQuery.stop()` only drops a late result: a read already waiting in the database queue still
runs, so fast typing in a search queues one full read per keystroke and the last one waits behind
them. Check the stopped flag when the read starts.

### [ ] Upload a photo's file and thumbnail at once

The upload loop (`CloudSyncProvider.js`) uploads the file, then the thumbnail, and writes the
asset twice (`isFileSynced`, then the rest). Uploading both at once (`Promise.allSettled`) and
writing the flags in one `updateAsset` halves the waits and the writes per photo.

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
`AssetPager` never learns the new page (header, actions and notes stay on the first photo).

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

### [ ] Check the library-ownership release on the phone

The first launch after `docs/library-ownership-plan.md` turns `squidbox.db` into the library
`squidbox` without moving anything (`src/library/rebuildRegistry.ts`). No downgrades past that
build: an older one would open `squidbox.db` with its wipe-on-switch logic and knows nothing of
`library-*.db`. On the phone, confirm:

- Migration: signed in, every photo, album and post and the session are still there; signed out,
  the library shows with the sign-in form. Note the time from splash to library.
- Files: adding a photo from the camera roll and backing it up still works (the migrated library
  keeps `assetfiles/` and `assetthumbnails/`; a fresh install writes under `libraries/<id>/`).
- Sign-out: with everything synced, "Sign out" signs out at once; the library stays, with its
  photos, the avatar shows the badge and Settings "Backup paused · Sign in to continue" above the
  sign-in form with the email pre-filled. Add a photo while signed out; sign in again → no
  "Setting up your library", the photo uploads with "Back up now".
- Sign-out with unsynced work: add a photo, sign out before it is backed up → "You have media
  that isn't backed up yet" → Cancel keeps you signed in, Sign Out signs out.
- Another account: signed out of A, "Sign in as someone else" as B → "Opening your library…", B's library
  (its first sync if new); sign in as A again → A's library with the photo still waiting.
- Expired session: revoke the phone's refresh token server-side (or set `tokens` to null in the
  stored session) → no alert, only the red dot on the avatar and the "Backup paused" row; still
  placeholders for thumbnails not on the phone.
- First sign-in on a fresh install: add two photos (one already in the account), an album with
  them and a post before signing in; sign in → no dialog; after the setup screen everything is in
  the account, the new photo with its thumbnail, "Back up now" uploads it; the camera-roll
  duplicate is a second copy (the merge runs before the first pull; see the plan's "Changed" note).

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

### [ ] Check the boot screen and the octopus on the phone

`BootScreen` (`src/features/boot/`) takes over from the native splash a frame after it has laid out,
and fades out once the first screen shows. Only the web preview has checked it so far. On the phone,
confirm: there's no jump or flash from the splash to the boot screen or from it to the app, the
octopus moves smoothly on the boot screen and the setup screen (`src/components/octopus/`, 7 arms'
paths rebuilt at 30 Hz at rest, every frame during a tap), a tap squeezes the head without a seam
where it meets the arms, and with Reduce Motion (also toggled while it shows) it stands still and the
setup screen shows a spinner that VoiceOver reads as busy.
