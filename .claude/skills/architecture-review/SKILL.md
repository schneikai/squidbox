---
name: architecture-review
description: Use when the owner asks to review the architecture, structure or consistency of the app or a part of it against software design best practices, or to find cleanup and alignment work. The periodic part of a three-part system (the build skill prevents defects on every change, CI detects them, this review finds and closes what both missed). It answers three questions with evidence, fixes the most consequential finding with the build skill, ships the lint rules that keep the rest from coming back, and hands the owner only the decisions.
---

# Review the architecture

You are the **coordinator**, the top-level session. The run is complete when at least one important correction is built and verified, not when a report exists. The report is a byproduct. The prompts for every subagent are in [briefs.md](briefs.md); the research behind the rules is in [evidence.md](evidence.md), with sources. Project rules come from CLAUDE.md.

The code is written and maintained by agents, and the owner reads only the summary in the thread, never the code or the PRs. So the review optimises for the next agent change being correct, cheap, independently verifiable and recoverable, not for how the code looks. Five properties, in order:

- **Correctness**: behaviour matches the design docs and CLAUDE.md, data survives crashes, concurrency, migrations and retries, one account never sees another's data, an older app version survives newer data. A test is evidence only when it was derived from the contract, not the code, and shown to fail when the behaviour is broken. The docs can be wrong too: the owner is the one who can say so, so every risk states its contract sentence in plain words.
- **Change locality**: an agent finds the right code (one owner per responsibility, names it would grep for, CLAUDE.md as the routing table) and crosses only the boundaries the change needs (database, sync, API, UI are real ones; a folder that is not one is coupling). Counts of files or folders are evidence only when the finding says which change they make expensive.
- **Mechanical enforcement**: a rule holds when a lint, the typecheck, a database constraint or a test holds it; prose loses to the nearest example. What none of them can hold (whether a screen looks right) is checked by looking at the running app, never assumed.
- **Verifiability**: every consequential change has evidence from a test run, real execution or a screenshot, and the agent that made the change is never the only source of it.
- **Recoverability**: a bad change fails loudly and close to its cause; recovery is explicit and visible, never a silent fallback.

Duplication is a finding only when the copies must change together or a third copy appears. A small file is a proxy, not a goal. An extension point counts only where a change has already asked for it.

## Scope

The owner names the scope when starting the run: the whole app, an area (`apps/mobile/src/sync` with `library`; the mobile `features` with `components`, `hooks`, `lib` and `utils`; `apps/server` with `packages/shared`), or one feature. A question ("is the contacts code put together right?") is not a run: answer it yourself.

## Workspace

`.work/review-<slug>/` (slug: kebab-case from the scope; `.work/` is gitignored): `map.md`, `reports/<angle>.md`, `screens/` (the UX reviewer's screenshots, `[SCREENSHOT_DIR]` in its brief) and `dropped.md`, one line per finding you dropped and why.

## Steps

### 1. Map

Read CLAUDE.md, `docs/sync-design.md` §8 and §12, `docs/library-ownership-plan.md`, the `squidbox-ui` skill's conflicts table, and every earlier report in `docs/reviews/`. Run the counts over the scope; each goes into the map with the command that produced it:

- the import matrix between top-level folders (feature → feature, `utils`/`hooks`/`components` → `features`, `utils` → `library`), aggregated per folder pair;
- `catch` sites per folder;
- files over 300 lines, each with how many commits touched it in the last 30 days: a large file that changes often is the hotspot, a large one nobody touches is not;
- what went wrong: the last five PRs merged into main (`git log --first-parent --merges` or the squashed commits), each with the folders its diff touched (`git show --stat`) and the fix-up PRs, reverts, failed CI runs or commits that followed it.

Dispatch the map writer ([briefs.md](briefs.md), "Map") for the whole scope, or write the map yourself when the scope is one feature. Save it as `map.md`. When an earlier report exists, diff its counts against the new ones, and for each finding it fixed, check that the test it added still runs and still fails when the behaviour is broken, and whether its failure class came back.

### 2. Investigate

Three questions, each with its own kind of evidence; a grep answers the third, never the first two. Start `npm run dev:local -- --web` (README.md "Web preview") and launch the reviewers together, in one message, each with a fresh context and its brief:

- **What actually went wrong?** Every reviewer starts from the recent changes in the map: where did the structure, a missing test or a missing rule make a change cost more than it had to, or let a bug through?
- **What could still go badly wrong?** **Data integrity** runs the failure scenarios (offline edits on two devices, a crash between writes, replayed or reordered operations, migrations over old data, interrupted uploads, an older app version) against the real repositories and quotes the results; **UX parity** drives the screens in the web preview and inventories labels, flows and one-off styles. When the preview cannot start, the run is blocked, not done: stop and tell the owner.
- **What makes the next change unnecessarily difficult?** **Homes and boundaries** traces likely changes through the tree; **Discoverability by task** sends three cold agents to find the code for representative tasks.

If the owner named an extra focus, put it in the common tail's `[ADDITIONAL_FOCUS]`. Each reviewer checks its own findings against the criteria in the common tail, writes `reports/<angle>.md` and returns one line.

### 3. Rank

Merge duplicates across angles. Sort into **risks** (Data integrity's findings, and anything else that can lose or corrupt data, cross an account boundary or ship a regression) and **friction** (everything else). Rank risks by consequence and likelihood, a scenario that failed when run first; friction by recurring cost per change, tied to a recent change where it can be. Open the file for each finding you keep; drop what fails a criterion into `dropped.md`, one line, and do not argue with it. Turn each task agent's stalls into findings. There is no target count: as many as have a cost, usually fewer than ten.

### 4. Fix

Build the top finding with the build skill, one request: "Build finding R1 (or F1) of the review in `.work/review-<slug>/`", and keep going down the list while a finding is S or M and changes nothing a user sees without the owner's say. A risk's fix is first its test: written from the contract sentence the finding quotes, before reading the implementation; shown to fail with the behaviour deliberately broken and to pass after the fix; both runs quoted in the PR. When the top risk is L, touches a migration or changes what synced data means, build only its reproducing test (marked as expected to fail until the fix lands) and escalate the fix as the owner's first decision: a wrong fix there is worse than the gap. A risk that is not fixed is **open**, never closed, in every place it is mentioned.

### 5. Enforce

For each class of finding, add the lint or check that keeps it from coming back, the way the repo does it: a rule in `apps/mobile/.eslintrc.js` (`no-restricted-syntax` with an AST selector carries UI rules too, as the spacing rule shows; `no-restricted-imports` carries boundaries and primitives), a script beside `scripts/checkNewFiles.mjs`, or a test, each run by `npm run check` and CI. Only rules CLAUDE.md or a design doc already states; a new constraint is a finding the owner picks. A rule ships only with zero hits: fix them when that is under an hour, otherwise the fix is a finding and the rule ships with it. No baselines and no new `eslint-disable` marks: a marked exception becomes the pattern agents copy. When a rule carries a CLAUDE.md sentence completely, the build that ships it removes the sentence with the `tidy-claude-md` skill.

### 6. Report and tell the owner

Write `docs/reviews/<date>-<slug>.md`: the three questions answered in a paragraph each; what was fixed and how it was verified; **open risks**, marked; the remaining friction findings, each a complete build request in the common tail's shape; **Enforce**, with hit counts and what shipped; **Not findings**, from `dropped.md`; **Outcomes**, when an earlier report exists (each fix it shipped: still protected or not, and whether its failure class came back; each count: better, same, worse). Commit it with the enforcement on a branch `review-<slug>` (unless the environment already put you on a branch for this work), push, open the PR.

Then tell the owner, in plain words and no file paths: what went wrong, what was fixed and verified, what is open and why, each open risk's contract sentence so they can say it is wrong, what is now enforced, and the decisions left: numbered, with your recommendation. Nothing else waits on them. The owner answers with numbers; each becomes a build thread with the one-line request "Build finding N of docs/reviews/<date>-<slug>.md".

## Rules

- Thorough model (`fable` in Claude Code today) for every subagent; set it on each dispatch. The exception is the three task agents of Discoverability by task: their brief reads as a reasoning probe to the thorough model's safeguards, which stop them; dispatch those on the standard model (`opus`).
- The run never writes `todo.md` or CLAUDE.md. A new rule is a finding; the build that implements it adds its line through the `add-rule` skill.
- The briefs name folders, item kinds, scenarios and tasks as they are today; the map is the truth. Swap a scenario or task that no longer fits and say so in the report.
- No health score, no average: named counts, their trend, and the tail (the worst files, the worst screens).
- Narrate at most one line between tool calls; post the owner a short status after the map, the reviews, and each PR.
