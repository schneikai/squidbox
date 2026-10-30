# CLAUDE.md

## Project Overview

Squidbox is an Expo/React Native app for content creators to manage media, posts and contacts, with a local-first architecture, cross-device sync and AI-assisted workflows. The repo holds the mobile app (iOS first) and web app in `apps/mobile/`, and the Fastify/PostgreSQL backend hosted on Fly.io in `apps/server/`.

What matters most, in order: a beautiful, intuitive UI, data integrity, performance and reliability.

## Code layout

- Follow the patterns of the code around you. Before writing a new component, hook or helper, check `src/components`, `src/hooks` and `src/lib` for one that already does the job
- One exported component or utility per file. Small private helpers may live in the same file
- Group by feature (`src/features/<feature>/`), next to where the code is used. Move code to `src/components`, `src/hooks` or `src/lib` only when more than one feature uses it

## Where data is saved

Decide this before the app stores anything new:

- **Synced with the account**: what the user makes or sets up and would miss on another device: media, albums, posts, the assistant setup, prompts, and choices that change what the app produces (like the model the assistant uses). Add a collection (`docs/sync-design.md` §9). When unsure, sync it
- **On the device, in the library**: developer and testing tools (the model list and its testing) and data tied to this device's copy of the library. Local tables in `src/sync/db/schema.ts`, outside the collection registry
- **On the device, for the whole app**: how this device looks and behaves (sort orders, thumbnail style, autoplay, haptics), like iOS settings. `AppSettingsProvider`
- **On the server, for every account**: facts the admin sets for the whole app (which models are verified, the defaults, their Verify runs, the published instructions). Plain tables outside the collection registry, read through the API, never synced
- Sessions, sync bookkeeping and caches never sync

## React

- Exported components are function declarations, ordered hooks → derived values → handlers → early returns → JSX

## UI / Components

- Build screens from the components in `src/components`. Don't recreate their look with styles or use low-level primitives (raw `TextInput`, menu primitives) in features when a project component exists. If a UI pattern repeats, extract a component
- Don't spread style objects in screens or features
- One name per feature or label, in every text that mentions it (rows, footnotes, alerts, badges, errors), even when quoting a provider: Verify, never check or test; "Venice rates it uncensored", never unrestricted. Before writing UI text, grep for the name the app already uses
- Components define their appearance; parents define layout
- Animate with the `motion` tokens in `styles/designTokens.js` (`enter`, `exit`, `move`, `spring`), not ad-hoc durations, easings or spring values
- Give haptic feedback through `hooks/useHaptics`, never expo-haptics directly: it respects the Haptics setting and skips builds and web without the native module. Use it only for meaningful moments (a lift, a drop, a peek, a selection change, a success or an error), never for every tap
- Push a screen to go deeper (a photo, post or album, a Settings section, a list). Open a sheet (`presentation: 'modal'` with `asModalRoute`) for a task that ends where it started: creating or editing one item (`components/EditSheet`, `TextEditSheet`), picking something, a flow. A sheet is a draft: × on the left (a `Button` with `icon="close"`) closes it without saving, Add (new item) or Save (edit) on the right saves and closes it, both off until the item is valid and changed; leaving with changes asks first (`hooks/useDiscardGuard`). Inside a sheet, more steps push inside it with Back, never a second sheet. Short info or a quick in-place edit about the current screen goes in a `BottomSheet`, one line of text in an alert prompt
- A screen pushed outside a sheet saves its edits as you type, like iOS Settings (`hooks/useSaveAsYouType`): no Save buttons or discard prompts. One pushed inside a sheet is a draft like the sheet

## Code Quality

- The project checks are `npm run lint`, `npm run typecheck`, `npm run knip` and `npm test --workspaces --if-present`, all from the repo root. Run them before committing and keep them clean
- Add to `knip.json` only files Expo or Metro load by convention. Delete code that is merely unused

## Tests

- Test behavior a user or another module relies on, one rule per test, named as that rule. Don't test constants, config values or what the types already guarantee
- Before adding a test, look for one that already covers the case and extend it instead of copying it
- A fixed bug gets the smallest case that failed: a pinned seed or one scenario, not another round of random cases
- Size seeded fuzz tests with `fuzzRuns` (mobile) or `cases` (server): a plain run takes a few seconds, `FUZZ_DEEP=1` (CI) runs them all
- Check performance by counting work (statements, rows read, query plans), never by timing it
- A test file that takes over a second in a plain run needs a reason: put the large-scale part behind `FUZZ_DEEP` or the DB suites

## AI prompts

- Every prompt the app sends to the AI is editable by an `ai_admin` account (Settings → Assistant → Admin → Instructions): an edit is an override only that account uses, to try it in the app; Apply changes for everyone publishes it as the app's text for every account (`app_instructions`, served with the catalog). Give new prompts the same treatment
- The built-in texts in `packages/shared` are the fallback for a kind nothing was published for. Change one only in a PR, after the new text was tried as an override

## TODO list

`todo.md` is the single list of open work, ideas, and steps only the owner can do. Keep it current:

- Never add an entry on your own. When you find a bug, a weakness or a missing piece you don't fix, propose the entry to the owner and add it only when they say yes
- Remove an entry when it's done, in the same commit as the work
- Keep entries short: what's wrong or wanted, where in the code, and why it matters
- After committing a change to `todo.md`, republish its page as the comment at the top of `todo.md` says

## Builds, preview and the dev client

- The Expo app lives in `apps/mobile/`: run app commands and read its env files there. `npm install` runs once at the repo root (npm workspaces)
- For builds, signing and credentials, follow the `ios-build` skill. Build the dev client only when native code changes; "start the dev client" means `npm run dev:local` (`README.md` → "Dev client")
- The dev client never runs against the live backend, unless the owner explicitly asks for it in that conversation (say, to look into a problem in their own account). Then, and only then, add `--live-backend-on-owner-request`
- To see a UI change without a phone, use the web preview (`README.md` → "Web preview"). Check native-only behavior (camera roll, uploads, gestures) on a device
- If `dev:local` can't write `.env.local`, don't start Metro by hand: ask the owner for the missing values
- Stop it with SIGTERM or Ctrl+C on the script, and end your reply with the URL it prints to open in Squidbox (Dev), not the startup logs or localhost URLs
- Mock data (`apps/server/scripts/seed-mock.ts`) is one guy posting his outdoor photos on Bluesky: keep new mock content in that persona
