# UI design skills: handover

Two Claude Code / agent skills, lifted out of the Squidbox monorepo so you can reuse them in
another app. Drop a folder into `.claude/skills/<name>/` (project) or `~/.claude/skills/<name>/`
(user-wide) and the agent picks it up.

## `apple-design/` — not ours, came from a package

This one is **third-party**. It's the published skill `dickwu/apple-design-skill`:

- GitHub: https://github.com/dickwu/apple-design-skill
- Install fresh (any agent) with the skills CLI: `npx skills add dickwu/apple-design-skill`
  - one agent only: `npx skills add dickwu/apple-design-skill -a claude-code`
  - user-wide: add `-g`
  - update later: `npx skills update apple-design`
- Or by hand: `git clone https://github.com/dickwu/apple-design-skill.git ~/.claude/skills/apple-design`

It's a design reviewer grounded in Apple's Human Interface Guidelines (123 HIG pages pulled from
developer.apple.com under `references/hig/`, plus a cross-platform translation layer for Flutter /
React Native / Tauri / Electron / SwiftUI / UIKit / AppKit). The copy here is a point-in-time
snapshot, so for the latest version prefer installing from the source above rather than this one.
It has **no Squidbox-specific content** and is portable as-is.

## `squidbox-ui/` — ours, and Squidbox-specific

This is a hand-written playbook (just `SKILL.md`). It is **not portable unchanged** to a different
app. It mostly sets precedence and routes to files that only exist in the Squidbox repo:

- References `packages/design-system/docs/design.md` and `unistyles.md`, `apps/app/src/ui/`,
  `breakpoints.ts`, the Gallery, etc. None of those exist elsewhere.
- Its genuinely reusable ideas are the **method**, not the paths:
  - Precedence: Apple HIG for UX → Expo/RN for implementation → **your own design system is the
    final authority** (name the tension when HIG and the contract disagree; never deviate silently).
  - The **capability-based adaptive model**: decide from available window width + input
    capabilities (touch/pointer, keyboard, hover), not device type. Phone/tablet/web/desktop are
    test categories, not code branches.
  - It defers to `apple-design` for UX and treats it as a sub-skill.

To adopt it in a new app: keep the precedence + adaptive-model sections, then rewrite the "What to
read" / "Where things live" tables to point at that app's design system and folders.

## How they relate

`squidbox-ui` is the router; `apple-design` is the engine it calls for HIG/UX questions. In a new
app you can use `apple-design` standalone, and port `squidbox-ui`'s thinking into a thin local
playbook of your own.

Source: `schneikai/squidbox`, `.claude/skills/` on branch `phase-1-monorepo-spine` (at export time).
