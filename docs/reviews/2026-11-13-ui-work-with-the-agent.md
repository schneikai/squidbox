# UI work with the agent: what went wrong on post channels

PR #127 (post channels), November 2026. The channel switcher took about a dozen design rounds, most of
them corrections the owner had to make by hand. This note lists what went wrong,
why, and what would stop it happening again. It backs the todo entry "Make UI work with the agent
reliable".

## What happened

1. **Designs were drawn, not built from the app.** Every canvas was hand-written HTML and CSS that
   imitated the app: pills, chips, cards and headers redrawn from memory and from token values. They
   were never the real components, so they drifted from the app in color, spacing, weight and
   shadow, and the owner had to judge pictures that the app could not actually produce.
2. **The agent did not know what the screens look like.** It designed the switcher before looking
   at the list, the post screen and the editor as they are. "Show the three screens as they look
   today" had to be asked for, twice (the second time: "on a canvas"). Its attempt to screenshot the
   component gallery in the web preview failed (the page scrolled oddly), and it drew the Chip board
   from `Chip.tsx`'s tokens instead of shooting it.
3. **A new component instead of an existing one.** The build added `Bubble`, a copy of Chip's frame
   (`chipFrame`) with its own selected look: white with the raised shadow, which is the toolbar's
   look, used inside page content. The owner had to point out that in-page buttons don't use the
   toolbar's 3D look, that violet is only the assistant's, and finally ask "Why don't you check the
   existing components" and "There is no plain white chip?". `Bubble` is now gone; the tabs are
   `Chip`s.
4. **It proposed components it should have known were taken.** It offered `SegmentedPill` for the
   tabs. In this app it is the tab bar, so it can't be used for anything else.
5. **Predictable problems were found by the owner on the device.** Showing only the selected
   channel's label made the bubbles move when one was tapped. Overlapping logos like avatars looked
   wrong. Bubbles sat inside the card in the list and outside it on the post screen. Each was visible
   in the design before it was built, and none was raised by the agent first.
6. **Idea rounds without grounding.** Five "completely different" ideas from a subagent (footer
   logos, title menu, one post per channel, side by side, bottom dock) used generic patterns that
   ignored the screens they would live in: the list's footer is already taken, a bottom dock is the
   wrong place for a switch, and one post per channel changes the model. All five were rejected.
7. **The library contradicts the rules.** CLAUDE.md says violet marks only the assistant, yet
   `Chip`'s selected state was violet (as are `Button isSelected` and some pickers). An agent that
   follows the components breaks the rule, and one that follows the rule has to invent a style.

## Why

- **No picture of the app the agent can read.** It has the code, but no current screenshots of the
  screens or of the component gallery, so it reasons about the look from source and guesses.
- **The component library is hard to search by purpose.** `Chip` is a tag, a toggle, a tab, an
  assistant prompt, an add button and a mixed-state tag, told apart by props. Nothing says "for a
  row of tabs inside a page, use X". The gallery is one 556-line screen without a written index.
- **Canvases start from scratch.** Nothing turns real components into canvas pieces, so every board
  is an imitation.
- **The squidbox-ui skill says "reuse components" but has no step that forces it**: no inventory
  of what each on-screen element is, and no "name the component for every element" check before
  a design is shown.

## What would fix it

1. **Screenshots the agent can read.** A script that shoots every screen and every gallery specimen
   from the web preview with the mock data (iPhone size), stored where the agent finds them, and
   refreshed when a component or screen changes.
2. **Canvases from real components.** Build canvas boards from those screenshots or from the
   rendered web preview, never from hand-written CSS. A proposal is a change to the real screen,
   shown on the canvas as a screenshot.
3. **A design step in the squidbox-ui skill:** before proposing anything, (a) shoot the screens it
   touches as they are today, (b) list each element and the component and variant it uses, (c) state
   any new style as a component change to approve, (d) list the obvious problems (moving content,
   inconsistency between screens, contrast) before the owner sees it.
4. **A component inventory** (the second todo entry): what each component is for, with a picture,
   so "which component is a tab inside a page" has one answer.
5. **Make the library follow the rules**, so following a component never breaks CLAUDE.md
   (violet only for the assistant, no toolbar lift in page content).
