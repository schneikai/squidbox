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
- Sessions, sync bookkeeping and caches never sync

## React

- Exported components are function declarations, ordered hooks → derived values → handlers → early returns → JSX

## UI / Components

- Build screens from the components in `src/components`. Don't recreate their look with styles or use low-level primitives (raw `TextInput`, menu primitives) in features when a project component exists. If a UI pattern repeats, extract a component
- Don't spread style objects in screens or features
- Components define their appearance; parents define layout
- Animate with the `motion` tokens in `styles/designTokens.js` (`enter`, `exit`, `move`, `spring`), not ad-hoc durations, easings or spring values
- Give haptic feedback through `hooks/useHaptics`, never expo-haptics directly: it respects the Haptics setting and skips builds and web without the native module. Use it only for meaningful moments (a lift, a drop, a peek, a selection change, a success or an error), never for every tap
- Edits save as you type, like iOS Settings (`hooks/useSaveAsYouType`): no Save buttons or discard prompts; a new item is created once it has content

## Code Quality

- The project checks are `npm run lint`, `npm run typecheck`, `npm run knip` and `npm test --workspaces --if-present`, all from the repo root. Run them before committing and keep them clean
- Add to `knip.json` only files Expo or Metro load by convention. Delete code that is merely unused

## AI prompts

- Every prompt the app sends to the AI is editable: by the user (Settings → Assistant → Instructions) or, for an `ai_admin` account, as an override for that account (App prompts). Give new prompts the same treatment
- The built-in defaults live in `packages/shared`. Change one only in a PR, after the new text was tested as an override

## TODO list

`todo.md` is the single list of open work, ideas, and steps only the owner can do. Keep it current:

- Never add an entry on your own. When you find a bug, a weakness or a missing piece you don't fix, propose the entry to the owner and add it only when they say yes
- Remove an entry when it's done, in the same commit as the work
- Keep entries short: what's wrong or wanted, where in the code, and why it matters
- After committing a change to `todo.md`, republish its page as the comment at the top of `todo.md` says

## Builds, preview and the dev client

- The Expo app lives in `apps/mobile/`: run app commands and read its env files there. `npm install` runs once at the repo root (npm workspaces)
- For builds, signing and credentials, follow the `ios-build` skill. Build the dev client only when native code changes; "start the dev client" means Metro and its tunnel: `npm run dev:live` for the live backend, `npm run dev:local` for the local one with mock data (`README.md` → "Dev client: Metro + tunnel")
- To see a UI change without a phone, use the web preview: `npm run dev:local -- --web` from the repo root, then `npm run web:preview` in `apps/mobile/` (`README.md` → "Web preview"). Check native-only behavior (camera roll, uploads, gestures) on a device
- `dev:live` and `dev:local` write a missing `.env.local` from the environment variables. If they can't, don't start Metro by hand: ask the owner for the missing values. Without them every API call is broken
- Stop them with SIGTERM or Ctrl+C on the script: that stops Metro, the tunnel and the API server it started
- When the script prints the URL to open in Squidbox (Dev), end your reply with that URL, not the startup logs or localhost URLs
- Mock data (`apps/server/scripts/seed-mock.ts`) is one guy posting his outdoor photos on Bluesky: keep new mock content in that persona
