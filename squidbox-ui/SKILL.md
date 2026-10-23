---
name: squidbox-ui
description: >
  Squidbox's UI playbook. Load it BEFORE designing, building, restyling, or reviewing any screen,
  flow, component, navigation, or responsive/adaptive layout in the new UI (apps/app/src/app,
  apps/app/src/ui, packages/design-system), and whenever the apple-design skill is used in this
  repo. Sets the precedence between Apple HIG (apple-design), generic Expo/React Native advice, and
  our design system + Unistyles conventions (which win), defines the capability-based adaptive
  model (window width, touch/pointer, keyboard, hover), lists known conflicts, and routes to the
  right docs. Not for non-UI work (sync, server, engine, builds).
---

# Squidbox UI

## Precedence

Reason top-down, decide bottom-up:

1. **UX: Apple HIG** (`apple-design` skill): principles, hierarchy, navigation, adaptive layout,
   input methods, accessibility.
2. **Implementation: Expo / React Native knowledge**: routing, native behavior, RN-web.
3. **Our codebase: final authority**: `packages/design-system` (tokens, primitives, overlays,
   breakpoints), its docs, and the existing new-UI screens.

When a skill's example and the codebase disagree, follow the codebase. When a HIG principle and the
design contract disagree, follow the contract and name the tension in your answer; do not deviate
silently. Contract changes are deliberate design-system changes (doc + tokens + tests), never
screen-local exceptions.

## What to read

| Task | Read |
| --- | --- |
| Any UI change | `packages/design-system/docs/design.md` (the contract and its Forbidden list) |
| Writing styles or components | `packages/design-system/docs/unistyles.md` |
| New screen or flow, screen review, navigation/hierarchy, adaptive decision, accessibility audit | The `apple-design` skill: its always-load set, `references/cross-platform.md`, and 3–6 pages for what is on screen. For wide/pointer/keyboard layouts add `designing-for-macos.md`, `pointing-devices.md`, `keyboards.md`, `focus-and-selection.md` |
| Small change inside an existing component | This file + `unistyles.md`; skip `apple-design` |

## Where things live

- `packages/design-system/src/`: tokens (`common-theme.ts`, `semantic.ts`, `theme.ts`),
  `primitives/` (Text, Button, IconButton, Icon, Input, Switch, Checkbox, SegmentedControl, Badge,
  Surface, …), `overlays/` (Sheet, Dialog, AdaptiveModalSheet, ConfirmDialog, Menu, Popover, Toast),
  `breakpoints.ts`, `hooks/useIsCompactFormFactor.ts`.
- `apps/app/src/app/`: Expo Router routes and `_layout` files only.
- `apps/app/src/ui/`: app chrome and composites (screen header, large title, floating bars, grids,
  selection toolbars, detail headers). Reuse or extend these before adding new ones.
- `apps/app/src/dev/Gallery.tsx`: every primitive and overlay in both themes.
- **Legacy, never copy patterns from:** `apps/app/App.js` and
  `apps/app/src/{components,screens,navigators,styles}` (the old react-navigation app).

## Adaptive model: capabilities and space, not devices

Phone, tablet, web, and desktop are **test categories**, not branches in code. Decide from:

- **Available window width.** Breakpoints (`breakpoints.ts`): `xs 0 · sm 576 · md 720 · lg 992 ·
  xl 1200`. Compact = `xs`/`sm`, wide = `md`+. The same device moves between them: an iPad is wide at
  full screen and compact in Slide Over or a narrow Split View; a narrow web or Electron window is
  compact and gets the phone shape.
  - Structural reflow (tabs vs sidebar, stack vs master–detail, sheet vs dialog):
    `useIsCompactFormFactor()` only.
  - Value-level changes: Unistyles breakpoint objects (`{ xs: …, md: … }`) in styles.
  - Never `UnistylesRuntime.breakpoint` (no re-render), `Dimensions.get`, or screen size.
- **Touch vs pointer.** Sizing is the same for both: ≥ 44pt effective targets everywhere, and wide
  layouts reflow, they don't shrink. Pointer adds, it doesn't replace: right-click opens the same
  actions a long-press does (DS `Menu`/`Popover`), and nothing is reachable only by hover, swipe,
  or long-press.
- **Hover.** Comes from the DS interaction phase (`rest → hover → active → disabled`, painting
  `interactionHighlight`). `onHoverIn` fires only with a real pointer (mouse, iPad trackpad), so hover
  follows the capability on its own. Never gate hover on `Platform.OS`. For any custom Pressable,
  spread `useInteractionState().handlers` and render `<InteractionOverlay>` (DS): hover, press and
  keyboard focus ring in one, without layout shift.
- **Keyboard.** Keyboard support is additive and harmless where no keyboard exists, so wire it
  everywhere (iPad hardware keyboards count too): visible `focusRing` on focus, logical tab order,
  Enter submits, Esc dismisses overlays, arrow keys in menus. Add shortcuts for frequent commands.
  DS `useKeyDown` is the document key listener (overlays pass `{ overlay: true }` so they handle keys
  before the screen); app screens use `ui/hooks/useShortcuts` with `useScreenFocused()`.
- **Platform conventions where they really are platform conventions.** Use `Platform.OS` /
  `process.env.EXPO_OS` only for those: iOS swipe-back, safe areas, and haptics; Electron menu bar
  and window chrome (desktop shell only, not plain web). Never use it as a stand-in for size or
  input.
- **Floating chrome by width:** compact windows float pills in the corners (tabs bottom-right,
  search/filter bottom-left, header actions top-right). Wide windows gather everything into one
  top row: title pill left, tabs centre (`HeaderCenter`, labels from `lg` via `useBreakpoint`),
  search/filter/select/+ trailing, nothing at the bottom (HIG toolbars › Tablet). A docked opaque
  sidebar and a side rail were tried and rejected: they break the floaty language.
- **Overlays adapt by width:** `AdaptiveModalSheet` (sheet when compact, centered dialog when wide),
  `ConfirmDialog` for destructive confirmations, `Menu`/`Popover` anchored to their trigger, `Toast`
  for non-blocking feedback. Never use RN `<Modal>` directly.

## Apply the HIG as principles, not as an iOS costume

- On iOS, follow iOS conventions: safe areas, one-handed reach for primary actions, swipe back,
  sheets with a way out besides Done.
- On wide or pointer layouts, keep the principle and use the idiom that fits the input: dialogs and
  popovers instead of bottom sheets, sidebar or master–detail, hover and context menus, keyboard
  operation. Don't imitate iOS on web or desktop (no swipe-only affordances, no bottom sheets at wide
  widths, no fake iOS chrome).
- The HIG's macOS rules for menu bars, window controls, and a settings window apply only to the
  Electron shell. For plain web, use the principles and foundations only (accessibility, color,
  type, layout, writing), as `apple-design` itself says.

## Known conflicts: our decision wins

| Skill or generic advice says | Squidbox does |
| --- | --- |
| HIG: no app-specific appearance switch | Settings → Appearance (System / Light / Dark) is deliberate. Don't flag it. |
| HIG: 17pt body default | `fontSize.content.base` (16). Hierarchy by weight and tone before size. |
| HIG: desktop controls 28pt default, 20pt minimum | ≥ 44pt effective on every target, no control under 36pt, on every platform |
| HIG: SF Symbols | lucide icons via DS `Icon` / `IconButton` |
| HIG: Liquid Glass / materials | Same principle with our tokens: glass (`surfaceGlass` + `borderGlass` + blur) only on floating chrome, menus, sheets, and dialogs; `surfacePlate` or `scrim` for text over media; no blur in virtualized cells |
| apple-design improvement mode: plan a new palette, type scale, or token system | Map every proposal onto existing tokens. A real token change goes into `design-system` with the contract doc and the contrast/drift tests. |
| apple-design template check, Expo "slop" lists: violet gradient, floating pill tab bar | Frosted glass + one violet accent-gradient CTA per surface **is** the identity. Critique how it's executed, not the identity itself. The gradient only fills the CTA and is never a decorative hero. |
| Expo: `NativeTabs`, native stack headers, `Stack.Title`, `Link.Preview`, "never hand-roll the header" | JS `Tabs` + `FloatingNavBar`, `headerShown: false` + `ScreenHeader` / `LargeTitle`: deliberate chrome that renders the same on web and Electron. Don't migrate unless asked. |
| Expo: `formSheet`, `@expo/ui` components, RN `<Modal>`, `Alert.alert` | DS overlays (see the adaptive model above) |
| Expo: inline styles, RN `StyleSheet.create`, `Pressable style={({ pressed }) => …}` | Unistyles `StyleSheet.create((theme) => …)` with inline `theme.*` reads, flat style arrays, pressed via state, `withUnistyles` for color props (`unistyles.md` §1–3) |
| Expo: `Color` / `PlatformColor` palette, `theme/colors.ts`, hex literals, `boxShadow` strings | `theme.colors.*` and the theme's shadow tokens only |
| Expo: kebab-case file names | PascalCase, one exported component per file (AGENTS.md) |

## Checks worth keeping (adapted from Expo's skills)

Before calling a screen done:

- **Four states.** Loading, error, empty, and content. Never flash the empty state while the first
  load is running: live hooks return a sentinel until loaded (`isLoaded()` from `library-sync/react`),
  and `EmptyState` takes `loading`, a message from `lib/emptyMessage` (search vs filter vs nothing
  yet) and the next action.
- **Every enabled control works.** Search filters, Save commits, toggles change behavior. No
  empty handlers.
- **Edge content.** Long titles, missing thumbnails, no results, and the largest text size (Dynamic
  Type, browser zoom) all still work, and required actions stay reachable.
- **Keyboard.** On touch, the focused input and the primary action are never under the soft
  keyboard; use `keyboardShouldPersistTaps="handled"` on scrollable forms and search. With a
  hardware keyboard, the whole flow works with visible focus.
- **Back and dismiss.** Swipe or back on iOS; Esc and click-outside for overlays on wide layouts.
- **Both shapes.** Check compact and wide widths, including a narrow desktop window.
- **Motion.** Respect reduce-motion; routine screens just appear, with no entrance animations.
- **Press feedback.** Match it to the role: rows highlight, controls use the interaction phase.
  No `TouchableOpacity`, no layout shift on state changes.

Report what you ran and what you couldn't (for example, no hardware-keyboard or web run).

## Validate

- `pnpm check` at the repo root: lint, format, types, and every package's unit tests (incl. the
  design-system's contrast, drift, breakpoint and control-geometry tests).
- `pnpm test:e2e` for the Maestro flows; extend them for new screens and interactions.
- Visual checks: the Gallery harness or the new UI on the iOS Simulator (AGENTS.md → "iOS Simulator").

## The vendored `apple-design` skill

`.claude/skills/apple-design/` is an unmodified copy of github.com/dickwu/apple-design-skill at
`39ea3fb` (2026-09-22). Keep it unmodified and put Squidbox overrides here. To update it, re-copy
the upstream repo without `.git` and re-check the conflicts table above.
