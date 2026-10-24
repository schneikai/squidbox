# CLAUDE.md

## Project Overview

Squidbox is an Expo/React Native app for content creators to manage media, posts and contacts, with a local-first architecture, cross-device sync and AI-assisted workflows. The repo holds the mobile app (iOS first) and web app in `apps/mobile/`, and the Fastify/PostgreSQL backend hosted on Fly.io in `apps/server/`.

What matters most, in order: a beautiful, intuitive UI, data integrity, performance and reliability.

## File Organization

- One exported component or utility per file. Small private helpers may live in the same file
- Group by feature (`src/features/<feature>/`), next to where the code is used. Move code to `src/components`, `src/hooks` or `src/lib` only when more than one feature uses it

## React

- Use function declarations for exported components
- Order inside components:
  1. hooks
  2. derived values
  3. handlers
  4. early returns
  5. JSX

## UI / Components

- Build screens from the components in `src/components`. Don't recreate their look with styles or use low-level primitives (raw `TextInput`, menu primitives) in features when a project component exists. If a UI pattern repeats, extract a component
- Don't spread style objects in screens or features
- Components define their appearance; parents define layout
- Animate with the `motion` tokens in `styles/designTokens.js` (`enter`, `exit`, `move`, `spring`), not ad-hoc durations, easings or spring values
- Give haptic feedback through `hooks/useHaptics`, never expo-haptics directly: it respects the Haptics setting and skips builds and web without the native module. Use it only for meaningful moments (a lift, a drop, a peek, a selection change, a success or an error), never for every tap

## Code Quality

- The project checks are `npm run lint`, `npm run typecheck`, `npm run knip` and `npm test --workspaces --if-present`, all from the repo root. Run them before committing and keep them clean
- Add to `knip.json` only files Expo or Metro load by convention. Delete code that is merely unused

## TODO list

`todo.md` is the single list of open work, ideas, and steps only the owner can do. Keep it current:

- Add an entry when you discover a bug, a weakness or missing piece you don't fix right away, or when the owner defers something or mentions an idea
- Remove an entry when it's done, in the same commit as the work
- Keep entries short: what's wrong or wanted, where in the code, and why it matters
- After committing a change to `todo.md`, republish its page as the comment at the top of `todo.md` says

## Builds, preview and the dev client

- The Expo app lives in `apps/mobile/`: run app commands and read its env files there. `npm install` runs once at the repo root (npm workspaces)
- For builds, signing and credentials, follow the `build` skill. Build the dev client only when native code changes; "start the dev client" means Metro and its tunnel (`README.md` → "Dev client: Metro + tunnel", or `npm run dev:local` for the local backend)
- To see a UI change without a phone, use the web preview: `npm run dev:local -- --web` from the repo root, then `npm run web:preview` in `apps/mobile/` (`README.md` → "Web preview"). Check native-only behavior (camera roll, uploads, gestures) on a device
- Run `scripts/check-env.sh` before starting Metro. If `.env.local` is missing, don't start Metro: ask the owner for the values or to restore the file. Without it every API call is broken
- When Metro and the tunnel are running, end your reply with the tunnel URL to open in Squidbox (Dev), not the startup logs or localhost URLs
