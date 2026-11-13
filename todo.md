<!--
The owner reads this list as a page in the project library:
https://claude.ai/artifact/WduYaZ8KF63Bs9YmN1FK9A. After committing a change to this file, republish
that same artifact (Artifact tool: `read` it, then `publish` with `url` set to that link, so it
becomes a new version): replace the contents of its markdown block (`id="todo-md"`) with the
new file and set its `data-commit` and `data-date` to that commit. Change nothing
else on the page.
-->

# TODO

Open work, ideas, and steps only the owner can do. Entries are added only when the owner says so;
propose, don't add. Remove an entry once it's done.

## Bugs

### [ ] Signing out leaves the account's data on screen

A privacy problem, more so with contacts. Sign out (`CloudProvider.logoutAsync`) only drops the
tokens and stops sync; `openLibraryForSession` (`src/library/sessionLibrary.ts`) then keeps the
account's library open without them, so its photos, albums, posts and contacts stay visible to
anyone holding the phone. Signed out should show the device's own library (or nothing) and park or
remove the account's copy; unsynced changes need a warning first so nothing is lost.

## Features

### [ ] Record which builds are installed, before the App Store launch

Every request names its build and install (`x-squidbox-client: <commit> <device>`,
`apps/mobile/src/utils/cloud-api/clientHeader.ts`, name in `packages/shared/contracts/client.ts`);
the server ignores it (`apps/server/src/auth/authenticate.ts`). Before other people install the app:
a `devices` table written per account and install from the header, and a script listing them
(device, account, build, first and last seen), so a build's contract snapshot
(`docs/sync-design.md` §15) is retired only once no device runs it. Until then the owner is the
only user and knows his phone's build.

### [ ] Search: suggestions as you type, and what it matches

Wanted by the owner, later. While typing in a list's search (`SearchOptionsBar`), show a menu of
matching terms above the field, each with how many assets it finds (Apple Photos: "mvp 3",
"mvz 1"). Terms would come from the words of the assets' notes, tags and tagged contacts' names,
which is what `assetQuery` searches.

Maybe, too: the album search (`albumSearchQuery`, `matchedAlbumIds`) matches an album's name, notes
and the contacts on its photos, not the assistant's tags. Broad tags ("sky", "trail") would match
nearly every album, so count a tag only when it's on a good share of the album's photos (Apple and
Google Photos find albums by name only). The post search (`postQuery` `matchedIds`) matches only the
post's text (an @mention included); matching the contacts tagged on its photos, as the album search
does (`contactAlbumIds`), would find a post by the person in it.

### [ ] Make the app work on Android

The app is built and tested only for iOS. Needed:

- Config: an Android package id with a `.dev` variant like iOS (`app.config.js` switches on
  `EAS_BUILD_PROFILE`), Android settings in the `eas.json` profiles (an APK for internal
  installs) and an EAS-managed keystore.
- Photo access: Android 13+ media permissions and partial access (Android 14) in
  `useAddAssetsFromCameraRoll`.
- Platform differences: edge-to-edge insets, the back button and gesture (closing modals, the
  viewer, select mode), blur (`expo-blur` is slow or flat on Android: FloatingPill,
  BlurPopoverRenderer, QuickViewHost), keyboard events, HEIC display.
- Device checks of the gesture-heavy screens: pager, zoom, swipe-up details, drag-select, album
  reorder.
- Share: `modules/share-files` needs an Android side (`ACTION_SEND_MULTIPLE` with a
  FileProvider); until then Share is hidden there.

Test on an emulator or a phone.

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
sharing several assets.

### [ ] Mouse-friendly triggers on web

Touch gestures map poorly to a mouse: long press to peek, double tap to favorite and drag-select
are awkward with a pointer. When the input is a mouse, offer pointer-native triggers instead, for
example right click (context menu) to peek, hover affordances, and shift/cmd-click to select.
Related: on web a drag-select doesn't cancel the cell's press, so the cell it started on toggles
again after release (`SuperPressable` with `useDragSelect`); natively the pan cancels it.
After a drag reorder (photos in an album, the albums list) the drop also counted as a tap and opened
what it was dropped on; `SortableGrid` now swallows the click that follows a lift, unverified on web.

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

### [ ] Context menus on long press (photo, album, post, contact, list)

Apple-Photos-style menu on long press, the same everywhere: a preview with actions such as Share,
Save, Add to album, Favorite, Delete. For now a long press on a contact, list or post row opens a
plain anchored menu (`ContactRowMenu`, `ContactListMenu`), photos only peek and albums only drag;
this replaces all three. Build it in JS: the existing quick view (`QuickViewHost`) with a menu from
`components/popup-menu-options` under it, opened from the grids' "hold still" step (`onPeek` in
`components/sortable-grid/useDragReorder.ts`), so moving the finger still closes it and drags, as in
Photos, and it works on web. Unlike today's quick view, the menu stays open after the finger lifts.
Native menus were checked: `@expo/ui` `ContextMenu` ships with the SDK but is iOS only and takes the
touch, so drag-to-reorder can't follow it (fine later for screens that don't drag, like a post);
`zeego` and `react-native-ios-context-menu` would make SDK upgrades harder.

### [ ] From link for any profile link, not only X

From link reads only X links today (`useClipboardXLink`, `fetchXProfileAsync`, `POST
/ai/contact-from-link`). Any https profile link should work: fetch the page on the server, hand its
title, og:description/og:image and visible text to the writing model with the URL, and let it say
which handle the link itself is. Needs SSRF guards for user-given URLs (no private addresses, size
and time caps) and a photo from any host. Pages behind a login wall (Instagram, OnlyFans, X's hidden
profiles) get the "try From screenshot" alert. X may keep its own page read, as its data is cleaner.

### [ ] Contact places: a place database, and merging them in Settings

A contact's place is matched only against the user's own contacts (`citySuggestions`,
`autofillPlace`, `filledFrom`'s spelling step), so a new library gets places as the AI reads them
(no state outside the US) and a messy one copies its most used spelling, even a wrong one. Looking
cities up in a real place database (Apple Maps' place search or similar) would give official names
and states for both. Investigation: `contact-locations-cleanup/autofill-proposal.md` in the project
files. Also a Settings screen that lists the places the contacts use, with their counts, and merges
spellings and copies of one place into one (as the one-off cleanup of Nov 10 did by script), so a
messy library can be cleaned up in the app.

### [ ] Saved assistant chats

Wanted by the owner. The assistant chat (`features/post-chat`, `chatSessions`, one per post sheet
since #98) lives only while the post sheet is open. Keep past chats and list them to reopen, like the
ChatGPT or Claude apps, not tied to one post, so a chat about a trip or a bio can go on later. Needs a
synced collection for chats and their turns, a list screen, and a rule for when a new chat starts.
Saving a chat also decides where the tags edited on its card (`ItSeesRow`) go: today they last only
while the sheet is open and never reach the photos (#89). Saved on the post, a repost could reuse
them for a new caption; written to every photo they'd be wrong, as a post can mix subjects (a selfie
and a landscape).

### [ ] Tag each photo once at upload, on the server

Wanted by the owner. Photos are tagged on the phone (`features/photo-tags/tagAssetAsync.ts`): a chat
turn tags the never-tagged photos first and waits for them, and the photo's details offer Tag it.
Tagging every photo once on the server after its upload would make it instant and work for photos
added on another device. With it, maybe the photo's place: assets keep `latitude` and `longitude`,
but tagging (`apps/server/src/ai/tagging.ts`) sends only the image. A place name from the coordinates
(reverse geocoding) in the vision prompt would let tags name the landmark or park ("Half Dome",
"Yosemite") instead of guessing. Decide first whether a photo's place may go to the AI provider.

### [ ] Fill in Writing as you from your posts

Bring back "Fill it in for me" as an agent chat session that drafts About you, Tone, Your content and
Rules from the user's posts. It was removed from the setup flow (`features/voice`); the server route
was `POST /ai/persona/draft`.

### [ ] Post variants

A post keeps several versions for different platforms or uses: an X teaser, the OnlyFans post (full
video, other @ mentions), a PPV message. Each variant has a type, its own text and optionally its own
subset of the post's media and mentions; the post screen shows them as tabs with copy. Needs a synced
data model change (server and app). Threads already exist as posts of their own (`threadRootId`), so
a variant needn't be one. Mockups: https://claude.ai/artifact/LxxYDq2r7PNZ3bC37KNqWj, screens 10–12.

### [ ] Recreate thumbnails

An action to regenerate an asset's thumbnail. The video thumbnail in album 197 is broken. The backup
and the tiles already make a missing one again from the original on the device
(`ensureAssetThumbnailAsync`); one whose original is gone too (already backed up) only gets a backup
error, and could be made from the cloud original.

### [ ] Move the admin setup to the live server

Wanted by the owner, for when testing is done. "Apply changes for everyone" in the dev client writes
only to the local server. A script (say `npm run admin:copy-to-live`) that reads the local server's
published instructions (`app_instructions`), model defaults and Verified / Uncensored marks, shows
what would change on the live server and writes it after a confirm. The model list, its notes,
removed models and scores are local tables on the phone (`ai_models`, `ai_scores` in
`apps/mobile/src/sync/db/schema.ts`), so the script can't move them and another device shows a
different list: make them one synced collection (`docs/sync-design.md` §9) and move them from "on
the device" to "synced" in CLAUDE.md's "Where data is saved". Needs a server deploy before the app.

### [ ] Make Compare's fixed lines editable

Later, the owner's call. Compare sends four fixed texts that no ai_admin can edit, unlike every
other prompt (CLAUDE.md "AI prompts"): the format lines and "Write different ones." / "Give
different tags." (`COMPARE_*` in `apps/server/src/ai/prompts.ts`). Give them instruction kinds
so a better wording can be tried and published.

### [ ] Import photos from Ente

Wanted by the owner (asked about, not started). Read an Ente export (`ente photos export` or the
desktop app's Export): one folder per album, originals, and `metadata/<file>.json` with
`photoTakenTime`, `geoData`, `description`, `favorited` and Ente's `fileID`. These map to `takenAt`,
`latitude`/`longitude`, `notes`, `isFavorite` and the albums with their `album_assets`. People and
faces aren't exported, and a Live Photo comes out as an image and a video. Recommended: a script in
`apps/server/scripts/` modeled on `seed-mock.ts` (upload the files and thumbnails, push the records),
with a dry run and `mediaLibraryAssetId` = `ente:<fileID>`, so a photo in several albums is imported
once and a rerun skips it. Thumbnails in Node need sharp (with HEIF) and ffmpeg. An in-app import
from the web app is the fallback for other users. Ente's API is ruled out because it is end-to-end
encrypted.

## Design

- **Asset detail background:** a blurred background in the asset's colors.
- **Albums list:** a better layout for name, asset count and last posted.
- **Toolbar look.** The owner isn't fully happy with the toolbars yet (2pt frame, settings avatar
  outside the header pill) but has no better idea for now. Tried and dropped: a 3pt frame with the
  avatar inside the pill. Revisit when an idea comes up.
- **Dark mode.** The tokens are ready for it (`colors` are semantic roles over a private `palette`
  in `styles/designTokens.ts`), but there is no dark set yet: add one and pick it with
  `useColorScheme`, then check the screens that hard-code white (the octopus art).
- **Tokens left to do.** Two leftovers of the spacing scale: `SCREEN_PADDING` (`constants.ts`, an
  alias of `layout.sideGutter`) still stands in 12 files and can now become `layout.sideGutter`; and `QuickViewHost`'s `paddingVertical: 50`
  (`components/quick-view`) is a safe-area inset in disguise, to take the real insets.

## Code quality

### [ ] One voice in the UI (review run 2, decision 3)

`docs/reviews/2026-11-12-whole-app-run-2.md` F11–F18: seven shapes of delete confirm, 13 Title
Case labels, 12 alert titles outside "Couldn't …", two words for one action (Retry / Try again),
relative time written twice, no empty state on Library, Albums and Posts, a second sheet opened over
a sheet (six picker routes), a button inside a button (contact rows, repost cards). One
`useConfirmedDelete`, sentence case, "Couldn't …" alerts, `lib/relativeTime.ts`, and the tests N6–N9
in the report's section 4 so none comes back. Deferred by the owner until after the next review run.

### [ ] Row-level security on the collection tables (review run 2, F60)

The 16 collection tables are guarded only by `WHERE user_id` in each query; one missed clause shows
another account's data. One migration adding a policy per table, the request setting
`app.user_id`, and `apps/server/test/rls.test.ts`. Deferred by the owner.

### [ ] The rest of review run 2's friction findings

`docs/reviews/2026-11-12-whole-app-run-2.md`, section 3, not yet taken on: F5 (a feature imports
another's internals in 168 lines, 8 cycles; the rule "through `index.ts` only" and its ratchet test
N1), F9 (`lib/` vs `utils/` vs `constants.ts`, one folder), F21 (26 hand-typed route strings; typed
routes), F23 (the albums repository lives in a feature), F19 (40 components missing from the gallery),
and F6–F65 below them, each a complete build request. Plus the ready checks C1–C22 of section 4 whose
finding no thread took. Take them after the nine threads of Nov 13 land, biggest cost first.

### [ ] Read the chat's "More from your posts" more cheaply

The chat's Mentions sheet lists every handle the owner ever mentioned: while it's open,
`readMentionedTexts` (`apps/mobile/src/sync/postsRepository.ts`) reads the text of every live post
with an @, again on each post change, and `extractHandles` parses them all. Fine now, but costly
with thousands of posts. Keeping the handles with their counts in a table would avoid it.

### [ ] Drop the outbox's whole-record rows

`outbox.whole_record` (`sync/db/schema.ts`, the `fields` it leaves out in `sync/worker.ts`) exists
only for rows queued by a build before per-field sync (0011_outbox_fields). The phone is past it
and installedBuilds.e2e no longer covers it: a migration can drop the column once no such row can be left.

### [ ] CI gaps

- `.github/workflows/ci.yml` lints only `apps/mobile`; `apps/server` and `packages/shared` have no
  ESLint setup. Nothing bundles the app, so a wrong named import in JS passes until a build
  (`npx expo export` would catch it).
- A worklet that reads a captured binding in a default parameter, or calls a plain (non-worklet)
  function on the UI thread, only fails at runtime on the phone. A script could catch it: run the
  `react-native-worklets` Babel plugin over `src/`, find each generated worklet factory, read its
  `__closure` names, and flag those used in parameter defaults or bound to a plain function, a React
  hook result or an unresolved import that the worklet calls. An audit prototyped this (unpolished,
  with hard-coded paths); make it a `scripts/checkWorklets.mjs` run by `npm run lint`.
- CI and `apps/server/docker-compose.yml` run Postgres 16; Neon runs 18 (`db-backup.yml`). Bump both
  together; an existing local compose volume needs a dump and restore (or a fresh volume).

### [ ] One vertical drag per asset page

The photo's drag (`verticalDrag` in `useZoomGesture`) and the details panel's pan
(`useDetailsPanelDrag`) feed one track as two gestures. Merging them into one page-level pan was
tried and left: it needs checks on where each touch lands (catching the panel, a zoomed photo with
the details open), zoom state passed up to `AssetPage`, and new relations with the nested zoom
gestures, which only a phone can test. Revisit only if the two drift apart.

### [ ] More UI tests

The main flows have Playwright tests on the web build (`apps/mobile/e2e`, `npm run test:ui`);
everything else is pure logic in vitest. If screens need finer checks than a flow gives, set up
component tests (for example jest-expo with React Native Testing Library). For iPhone-only crashes the
web preview misses (like the worklet-capture and post-photo crashes), run Maestro flows on an iOS
simulator with EAS Workflows (a simulator build profile in `eas.json`, `.eas/workflows/*.yml`, a
`type: maestro` job) before each preview build: open a photo, zoom, swipe, open a post's photo,
share. Needs a test account with a few photos on the live backend (login as an EAS secret, since the
cloud can't reach the local mock backend) and costs EAS build time per run. Can't check gestures'
feel or sharing to other apps.

### [ ] Measure WAL on iOS

`db/client.ts` sets no journal mode (expo-sqlite sets none either). With one connection and the
FIFO queue, WAL adds no read concurrency, so take it only if a measured write-latency win on a
device justifies an iOS-only setting (web's OPFS storage measured slower with WAL).

### [ ] Investigate everything the app stores on the phone

The app promises not to clutter the phone's storage, so check every place it writes and whether
each is cleaned up: originals of uploaded assets (`assetFiles`, kept after upload?), thumbnails,
cloud downloads for Share (cache, kept a day for reuse), each library's SQLite database and
WAL, parked libraries, the image and video players' caches, the picker's and the
thumbnail makers' temporary copies (`pickImageFromMediaLibrary`, `createImageThumbnail`,
`createVideoThumbnail`) and whatever a crash or kill leaves mid-write. Outcome: a list of what
stays and why, fixes for leaks, and maybe a Settings view of the space used with a "Free up space"
action.

Parked libraries stay on the phone forever: signing in as another account parks the current library
(`src/library/switchLibrary.ts`) and nothing in the UI removes one since "Libraries on this iPhone"
went (`removeLibrary` now only serves the merge). A Developer or Settings action behind a recount of
the parked database would do, and it must keep or warn about originals that aren't uploaded yet.

### [ ] Find duplicates by content when the device library joins an account

The sign-in merge (`src/library/mergeLibrary.ts`) matches a photo the account already holds by its
camera-roll id, after the account library's first full pull (every merge waits for it). A photo whose
camera-roll id differs (imported on another device, or re-saved) still comes in twice. A content hash
per asset would catch those. Only worth it if duplicates show up in practice; a wrong match would hide
a distinct photo.

### [ ] Web preview gaps

The web preview (README → "Web preview") can't add photos from the camera roll, upload, download
files or pinch. Web versions exist only for tokens and thumbnails. Extend them if testing those
flows in the browser becomes worth it. Playwright's Chromium can't decode H.264 or HEVC, so the
mock videos (H.264) don't play in the preview; only a WebM would (an iPhone's HEVC `.mov` may not
play in desktop Chrome either).

### [ ] Sentry receives events from development

`Sentry.init` in `src/app/_layout.tsx` is always on, so the dev client and the web preview report into the
production project. Consider `enabled: !__DEV__`.

### [ ] One animation library

Animations use both React Native's `Animated` and Reanimated. Move the `Animated` ones
(`BlurPopoverRenderer`, `PopoverSurface`, `AssetImage`) to
Reanimated, so everything runs on the UI thread with one API.

### [ ] One sync for data and files

Records sync on their own (`sync/worker.ts`, the outbox) while files upload in a separate, manual
backup run (`sync/backupRun.ts`), each with its own errors and Retry All (Sync and Backup screens).
Consolidate into one procedure that syncs data and files together, automatically in the background,
with one status and one error list. Until then a photo added on one device shows on the others with
no picture ("Still uploading from your other device.") until someone taps "Back up now" there. The
owner wants this later, not now. Sync runs only while the app is open; a background task or a silent
push from the backend could keep the library fresh (real background sync via a native module?).

It also settles two smaller faults, which can be fixed on their own before it:

- The backup run skips assets with an outbox row (`backupRun.ts` `isUnconfirmed`), so their originals
  aren't deleted before the server has their record. The Backup screen still counts them as "N not
  backed up" with no hint why: a failed push is listed on the Library sync screen, and a pending one
  (an import right before Backup) needs another run. Backup could wait for the push first.
- Upload failures (`syncError`) are the one local-only field, on the synced `assets` table. Moved into
  a local `sync_failures` table, the `localOnly` descriptor machinery goes
  (`packages/shared/collections/define.ts`, `localOnlyKeys.ts`, the stripping in `outbox.ts` and
  `upsertRows.ts`, the reset in `mergeLibrary.ts`).

### [ ] Database and caches through the library handle too

Only the asset path helpers lost their `getLibrary()` fallback. `src/app/_layout.tsx` still builds the
sync target from `getDb()`/`getLibrary()`, `switchLibrary` uses `getLibrary()`, and the web thumbnail cache is
module-global. Closing a library already makes a late write fail, so this is tidiness, not safety.

### [ ] Say when this iPhone's library is stuck

The setup screen says this iPhone's photos join after the first sync (`FirstSyncScreen`); outside it,
a device library that doesn't join shows nothing in the app, so its photos are out of sight. Its data
is safe in each case; show it in the sync status or Settings, and how to get help:

- Its merge failed (it retries at each boot, `mergeDeviceLibrary`), or it waits for another library or
  account it joined (`joinedElsewhere` in `library/mergeMarker.ts`).
- Its database won't open (a failed migration, a damaged file): `openLibraryForSession` opens the
  session's own library instead, and the setup screen still promises the join.
- A row the server keeps rejecting (too large, invalid) holds it parked: `mergeLibrary`
  (`src/library/mergeRun.ts`) removes the device library only once the account's library has no
  outbox row left up to the newest at the merge's commit (`isPushed`, sync-design §8), whether the
  merge wrote that row or it was an older failed row of the account's. Or let the merge finish past
  a rejected row.

### [ ] Merge marks are one JSON value per source library

`mergeMarks:<source>` (`sync/status.ts`) holds a decision per merged record in one `sync_meta` value,
read and written whole by every pass: about 100 bytes per record, so ~1 MB for a 10,000-photo device
library. Fine for a few passes; a table keyed by record would scale if passes get frequent.

### [ ] `albumId` post scope and `albumLastPostedAt` count deleted albums' edges

`postQuery`'s `albumId` scope and `albumLastPostedAt` (`sync/assetSql.ts`) use
`liveAlbumAssetIds`, which checks the edge's deletion but not the album's, while the
`sharesAlbumWithPostId` scope and `albumQuery` exclude deleted albums. Harmless today (a deleted
album's screen isn't opened), but one rule would be cleaner. With it, have `postQuery`'s `albumId`
scope watch `schema.albums` as `sharesAlbumWithPostId` does, so both refresh when an album is
deleted or restored.

## Ideas

- **Backup progress ring.** The Backup screen shows a running backup as "sent / total" text.
  `components/ProgressRing` (now a shared component, used by the progress overlay) could show it
  there too. Owner to decide.
- **Thumbnail backfill.** Thumbnails load lazily, so one you never scrolled to is blank offline.
  A low-priority background backfill after the first sync would close that gap, using the existing
  queue's concurrency cap. Decide first: Wi-Fi only (recommended), any network, or stay lazy.
- **Server env precedence.** `node --env-file` never overrides variables already in the shell, so
  exported AWS credentials silently win over `apps/server/.env`. `npm run dev:local` strips them;
  plain `npm run dev` in `apps/server` doesn't. Loading `.env` with override semantics for local
  runs would remove the pitfall.

## Owner-side (needs a device, infra or secrets)

### [ ] Require the checks before a merge into main

`main` has no branch protection (the API answers 404), so #98 was merged while its CI run was still
queued (`docs/reviews/2026-11-12-whole-app-run-2.md` R10). In GitHub → Settings → Branches, protect
`main` and require the `check` and `ui-flows` status checks. Zero code.

### [ ] Renew iOS signing before Oct 10, 2027

The distribution certificate and both ad hoc profiles expire then, and installed apps stop opening.
Renew them via the **`ios-build`** skill (see "expired signing" there) a few weeks ahead.

### [ ] A read-only AWS key for the library copy

The dev client's copy of the owner's library signs its photo links with the live server's own AWS
keys, read from Fly at `npm run dev:local` (`scripts/dev.mjs` → `liveLibraryEnv`). The code only
signs GETs, but those keys can also delete. Create an IAM key that can only `s3:GetObject` on the
owner's bucket, add it to the cloud environment as `LIVE_AWS_ACCESS_KEY_ID` /
`LIVE_AWS_SECRET_ACCESS_KEY`, and drop the AWS keys from the Fly read.
