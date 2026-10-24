---
name: squidbox-ui
description: >
  Squidbox's UI playbook. Load it before designing, building, restyling or reviewing any screen,
  flow, component, toolbar or navigation in apps/mobile, and whenever the apple-design skill is
  used in this repo. Sets the precedence between Apple's HIG (apple-design), generic Expo / React
  Native advice and our own components and tokens (which win), lists the known conflicts, and
  says how to check a change. Not for non-UI work (sync, server, builds).
---

# Squidbox UI

## Precedence

Reason top-down, decide bottom-up:

1. **UX: Apple HIG** (`apple-design` skill): principles, hierarchy, navigation, toolbars, input,
   accessibility.
2. **Implementation: Expo / React Native knowledge**: navigation, native behavior, react-native-web.
3. **Our codebase: final authority**: `CLAUDE.md`, the components in `apps/mobile/src/components`
   and the tokens in `apps/mobile/src/styles/designTokens.js`.

When a skill's example and the codebase disagree, follow the codebase. When a HIG principle and
our design disagree, follow our design and name the tension in your answer; never deviate
silently. A design change is a deliberate change to a shared component or token, never a
screen-local exception.

## What to read

| Task | Read |
| --- | --- |
| Any UI change | `CLAUDE.md` (React, UI / Components) and `styles/designTokens.js` |
| New screen or flow, screen review, navigation, toolbar or accessibility audit | The `apple-design` skill: its always-load set, `references/cross-platform.md`, and 3–6 pages for what is on screen (`toolbars.md`, `tab-bars.md`, `buttons.md`, `sheets.md`, …) |
| Small change inside an existing component | This file; skip `apple-design` |

## Where things live

All paths are under `apps/mobile/src/`.

- `styles/designTokens.js`: `colors` (semantic roles in groups: `text`, `accent`, `status`,
  `background`, `border`, `overlay`; raw values live once in a private `palette`), `shadows`,
  `radii`, `layout` (gutters, bar and menu paddings), `sizes` (controls and icons), `typography`
  and `lineHeights` (Apple's text styles), `glass`, `motion`. Sizes scale with the screen
  through `scale()`. A new color goes into `palette` and gets a role named by purpose.
- `components/`: shared building blocks. Reuse or extend these before adding new ones:
  - Buttons: `IconButton` (every icon-only button; `variant`: `plain`, `danger`, `primary` for the
    purple gradient in a toolbar, `tinted`, `destructive` over content), `PrimaryButton` (a purple action with a label: `large` in a form or
    list, `compact` in a modal header), `TextButton`, `MenuButton` /
    `IconMenuButton` with `popup-menu-options/MenuOption` (anchored menus).
  - Floating chrome (`floating-bars/`): `FloatingPill` (a toolbar: a glass pill that groups
    buttons), `FloatingHeader` (main screens), `FloatingDetailHeader` (detail screens),
    `FloatingNavigationBar` and `FloatingSegmentPill` (both `SegmentedPill`), `SearchOptionsBar`,
    `SortFilterMenu` (its options button's menu, with a drill-down filter panel).
  - Modals: `ModalSheet`, `ModalHeader`, `ModalCloseButton`.
  - Forms and lists: `Field`, `TextInput`, `Textarea`, `SearchInput`, `Switch`, `settings-list/`,
    `ThumbnailRow`, `EmptyState`, `StatusScreen`, `ProgressRing`, `progress-overlay/`.
- `hooks/useHaptics` for haptics, `hooks/useReduceMotion` for reduced motion.
- `features/<feature>/`: screens' building blocks, grouped by feature; `screens/` and
  `navigators/` (react-navigation) wire them up.
- `obsolete-code/`: never copy patterns from it.

## Toolbars

- A toolbar is one `FloatingPill`: one button tall, with a thin glass frame around its buttons.
  Buttons that belong together share a pill; groups sit apart with a gap. At most three groups
  per bar (HIG `toolbars.md`).
- One purple `primary` button per toolbar at most, on the trailing side. Inside a pill it sits
  flat, without a shadow.
- The account avatar (`AccountButton`) sits on its own at the far right of the main header,
  outside any pill: it stands for the user, not for an action.
- Icon colors: `colors.text.primary` in the headers, `colors.text.secondary` in the bottom bars,
  `IconButton`'s `variant="danger"` for destructive actions and `isActive` for a setting that is on.

## Known conflicts: our decision wins

| Skill or generic advice says | Squidbox does |
| --- | --- |
| HIG: SF Symbols | lucide icons through `Icon` / `IconButton` |
| HIG: Liquid Glass / materials | Our glass (`FloatingPill`: blur + `glass` token + border) only on floating chrome, popovers and sheets; no blur in list cells |
| apple-design improvement mode: a new palette, type scale or token system | Map every proposal onto the existing tokens. A real token change goes into `designTokens.js` and applies everywhere |
| apple-design template check, Expo "slop" lists: violet gradient, floating pill tab bar | Frosted glass plus one violet gradient action per toolbar **is** the identity. Critique how it's executed, not the identity itself |
| Expo: `NativeTabs`, native stack headers, "never hand-roll the header" | JS tabs with `FloatingNavigationBar`, `headerShown: false` with `FloatingHeader` / `FloatingDetailHeader`: deliberate chrome that renders the same on web. Don't migrate unless asked |
| Expo: `@expo/ui` components, `formSheet` | Our components; `@expo/ui` only after asking (iOS only, takes the touch) |
| Expo: inline style objects, `Color` / `PlatformColor`, hex literals | `StyleSheet.create` with `designTokens` values only; no spreading of style objects such as `...glass` in screens |
| Ad-hoc durations, easings, springs | The `motion` tokens (`enter`, `exit`, `move`, `spring`) |
| Haptics on every tap | `useHaptics` for meaningful moments only (CLAUDE.md) |
| Expo: kebab-case file names | PascalCase, one exported component per file (CLAUDE.md) |

## Checks before calling a screen done

- **Four states.** Loading, error, empty and content. Never flash the empty state while the
  first load runs.
- **Every enabled control works.** No empty handlers.
- **Edge content.** Long titles, missing thumbnails, no results, the largest text size.
- **Keyboard.** The focused input and the primary action are never under the soft keyboard.
- **Back and dismiss.** Swipe back on iOS; every sheet has a way out.
- **Motion.** Respect reduce motion; routine screens just appear.
- **Press feedback.** Rows highlight, buttons dim or tint; no layout shift on state changes.
- **Accessibility.** Every icon-only button has an `accessibilityLabel`; targets are at least
  44 pt (`sizes.iconButton`).

Report what you ran and what you couldn't (for example, no device check).

## Validate

- `npm run lint`, `npm run knip` and `npm run typecheck` at the repo root.
- Visual checks in the web preview (`README.md` → "Web preview"; `npm run dev:local -- --web`,
  then `scripts/webPreview.mjs`), at iPhone 15 Pro Max size against the mock data. Check
  gestures, camera roll and uploads on a device.

## The vendored `apple-design` skill

`.claude/skills/apple-design/` is an unmodified copy of github.com/dickwu/apple-design-skill
(snapshot of 2026-09-22). Keep it unmodified and put Squidbox overrides here. To update it, copy
the upstream repo again without `.git` and re-check the conflicts table above.
