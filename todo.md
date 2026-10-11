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

### [ ] Uploads during an account switch

A file upload that is in flight while another account signs in can retry with the new session
and leave an orphaned file in that account's storage. Rare and harmless to metadata.

### [ ] Rework search to behave like iOS

The keyboard still pops up after switching tabs and after navigating back, and the ✕ (clear first,
close second) feels odd. Causes in the code: focus is driven by an effect on "search is active" with
a 300ms timer, so the input refocuses whenever a bar re-renders with search active (gating it on the
focused tab made search collapse when leaving a screen and refocus on return); search state is
shared by all tabs (`FloatingBarsProvider`); lists don't dismiss the keyboard on scroll. iOS pattern
(WWDC26 session 292): focus only on tap; a Clear button inside the field while it has text; a
separate Cancel that leaves search and hides the keyboard; scrolling hides the keyboard but keeps
the query; coming back to a screen keeps its query without reopening the keyboard; search state
per screen; a descriptive placeholder instead of "Search…".
### [ ] Post suggestions skip a caption after loading more

When the next batch of captions finishes loading, the view jumps past the first newly loaded one.

### [ ] Caption on the post suggestion screen isn't keyboard-avoiding

Tapping the caption opens the keyboard, which covers the view. Decide whether it should be editable
there at all.

### [ ] AI chat corrections misbehave

Asking for corrections sometimes returns a single post instead of variations, and replies sometimes
contain raw markup such as JS array notation.

### [ ] Drag-select in the system photo picker moves the screen sideways

In the system picker (camera roll), tap-and-drag to select makes the whole screen move left and
right. The picker is native, so check what the app can influence through its options.

## Features

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
- **Post detail header:** a line break between date and time, or drop the time.
- **Albums list:** a better layout for name, asset count and last posted.
- **Circular progress:** a larger circle and smaller percentage text (`ProgressRing`).

## Code quality

### [ ] Find unused code with knip

Add [knip](https://knip.dev) for the whole workspace (`apps/mobile`, `apps/server`,
`packages/shared`) and remove what it reports. Run it in CI afterwards. `apps/mobile/src/obsolete-code`
is a deliberate "drawer for old stuff"; decide whether to keep it before knip flags it.

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
- **Easier local backend switching.** Pointing the dev client at the local backend means editing
  two env files and the tunnel URL by hand. A small script could switch between live and local.
- **Server env precedence.** `node --env-file` never overrides variables already in the shell, so
  exported AWS credentials silently win over `apps/server/.env`. Loading `.env` with override
  semantics for local runs would remove the pitfall.

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
