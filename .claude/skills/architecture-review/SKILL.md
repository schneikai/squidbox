---
name: architecture-review
description: Use when the owner asks to review the architecture, structure or consistency of the app or a part of it against software design best practices, or to find cleanup and alignment work. The periodic part of a three-part system (the build skill prevents defects on every change, CI detects them, this review finds what both missed). Three stages with nothing shared between agents but the scope: a scan by single-concern agents in parallel, a consolidation by a fresh agent into one finding per failure class, and a close that presents the report with at most four decisions. The run changes no code: every fix, and every lint or test that keeps a class from coming back, is a build request the owner picks and the build skill builds.
---

# Review the architecture

You are the **coordinator**, the top-level session. You dispatch, you spot-check, you tell the owner. You do not review code yourself, you do not rank findings yourself, and you change no code: a scanner sees one concern, the consolidator sees every finding, you see the scope, and the build skill does the work the owner picks. The prompts for every subagent are in [briefs.md](briefs.md); the research behind the rules is in [evidence.md](evidence.md), with sources. Project rules come from CLAUDE.md.

The code is written and maintained by agents, and the owner reads only the summary in the thread, never the code or the PRs. So the review optimises for the next agent change being correct, cheap, independently verifiable and recoverable, not for how the code looks. Five properties, in order:

- **Correctness**: behaviour matches the design docs and CLAUDE.md, data survives crashes, concurrency, migrations and retries, one account never sees another's data, an older app version survives newer data. A test is evidence only when it was derived from the contract, not the code, and shown to fail when the behaviour is broken. The docs can be wrong too: the owner is the one who can say so, so every risk states its contract sentence in plain words.
- **Change locality**: an agent finds the right code (one owner per responsibility, names it would grep for, CLAUDE.md as the routing table) and crosses only the boundaries the change needs (database, sync, API, UI are real ones; a folder that is not one is coupling). Counts of files or folders are evidence only when the finding says which change they make expensive.
- **Mechanical enforcement**: a rule holds when a lint, the typecheck, a database constraint or a test holds it; prose loses to the nearest example. What none of them can hold (whether a screen looks right) is checked by looking at the running app, never assumed.
- **Verifiability**: every consequential change has evidence from a test run, real execution or a screenshot, and the agent that made the change is never the only source of it.
- **Recoverability**: a bad change fails loudly and close to its cause; recovery is explicit and visible, never a silent fallback.

Duplication is a finding only when the copies must change together or a third copy appears. A small file is a proxy, not a goal. An extension point counts only where a change has already asked for it.

## Scope

The owner names the scope when starting the run: the whole app (the default when they say "the app"), an area, or one feature. The scan's code-quality agents work per area; the areas of the whole app are: mobile `features`; mobile `components`, `hooks`, `utils`, `lib`, `styles`; mobile `sync`, `library`, `app`; `apps/server/src`; `packages/shared`. A smaller scope is one of these, or one feature folder with the areas it imports. A question ("is the contacts code put together right?") is not a run: answer it yourself.

## Workspace

`.work/review-<slug>/` (slug: kebab-case from the scope; `.work/` is gitignored): `counts.md`, `recent-changes.md`, `map.md`, `findings/<agent>.md` (one file per scanner, never read by another scanner), `screens/` (the UX scanner's screenshots), `report.md` and `dropped.md` (the consolidator's), `spot-check.md` (yours).

## Stage 1: Scan

Everything a scanner needs is prepared first, in minutes, then every scanner launches in one message, each with a fresh context and only its brief:

1. Read CLAUDE.md, `docs/sync-design.md` §8 and §12, `docs/library-ownership-plan.md`, the `squidbox-ui` skill's conflicts table, and every earlier report in `docs/reviews/`.
2. Run the counts over the scope into `counts.md`, each with the command that produced it: the import matrix between top-level folders (feature → feature, `utils`/`hooks`/`components` → `features`, `utils` → `library`), aggregated per folder pair; `catch` sites per folder; files over 300 lines, each with how many commits touched it in the last 30 days.
3. List the recent changes into `recent-changes.md`: the last five PRs merged into main (`git log --first-parent --merges` or the squashed commits), each with its commit, title, the folders its diff touched (`git show --stat`), and the fix-up PRs, reverts, failed CI runs or commits that followed it.
4. Start `npm run dev:local -- --web` (README.md "Web preview") in the background and wait for the preview URL. When the preview cannot start, the run is blocked, not done: stop and tell the owner.
5. Dispatch, together: the **Map** writer; **What went wrong** (reads the recent changes' diffs); **Reuse**, **Simplification** and **Efficiency**, one agent per angle per area in scope; **Homes and boundaries**; **Data integrity** (runs the failure scenarios against the real repositories); **Discoverability by task** (three cold agents, one task each); **UX parity** (drives the preview). If the owner named an extra focus, it goes into the common tail's `[ADDITIONAL_FOCUS]` of every scanner.

Each scanner writes `findings/<agent>.md` in the common tail's shape and returns one line. A scanner that returns without a file, or whose file has no finding shape, is relaunched once with the same brief; after that its absence is noted in the report.

## Stage 2: Consolidate

When every scanner has returned, dispatch the **Consolidate** agent, fresh, with the findings folder, the map, the counts, the recent changes and the earlier reports. It merges every finding into one finding per failure class (one class, one fix, every site listed under it), sorts risks from friction, ranks, proposes the check that would keep each class from coming back with today's hit count, splits those checks into rules the project already states and rules it would be new, compares the counts and the fixed findings against the earlier report, and writes `report.md` with at most four decisions for the owner, and `dropped.md`.

Then spot-check it: open the file for every risk and for the five highest friction findings, and for each check proposed as "stated rule" find the sentence it rests on. Write one line per item to `spot-check.md`: holds, or what is wrong. Anything wrong goes back to the consolidator in one message with those lines; it revises once. You do not re-rank and you do not add findings; a finding you think it missed is a line to the consolidator.

## Stage 3: Close

1. **Report.** Copy `report.md` to `docs/reviews/<date>-<slug>.md`, commit it on a branch `review-<slug>` (unless the environment already put you on a branch for this work), push, open the PR. The PR holds the report and nothing else: no fix, no lint, no test. A check for a stated rule is a build request like any other (usually S: the rule, a negative test that it fires, today's hits fixed, at zero hits, no baselines and no `eslint-disable` marks); a check for a new rule is attached to the decision that would create the rule. A risk's build request begins with its reproducing test, written from the quoted contract sentence and shown red; when the fix changes stored or synced data, the request says so, and the build pins the test as expected to fail until the owner's decision lands. A risk is **open**, never closed, in every place it is mentioned until a build thread closes it.
2. **Tell the owner**, in plain words and no file paths: what went wrong, what could still go wrong (each open risk with its contract sentence, so they can say it is wrong), what makes the next change hard, which checks are ready to ship, the trend against the earlier run, and the decisions: numbered, at most four, each with your recommendation. The owner answers with numbers; each becomes a build thread with the one-line request "Build finding N of docs/reviews/<date>-<slug>.md". Nothing else waits on them.

## Rules

- Thorough model (`fable` in Claude Code today) for every subagent; set it on each dispatch. The exception is the three task agents of Discoverability by task: their brief reads as a reasoning probe to the thorough model's safeguards, which stop them; dispatch those on the standard model (`opus`).
- A scanner reads the code, the map and its brief, never another scanner's file. The consolidator reads findings, never the code beyond what a finding cites. You read what the spot-check needs.
- The run changes no code and never writes `todo.md` or CLAUDE.md. A new rule is a decision; the build that implements it adds its line through the `add-rule` skill, and a build that makes a CLAUDE.md sentence fully mechanical removes the sentence with the `tidy-claude-md` skill.
- The briefs name folders, item kinds, scenarios and tasks as they are today; the map is the truth. Swap a scenario or task that no longer fits and say so in the report.
- No health score, no average: named counts, their trend, and the tail (the worst files, the worst screens).
- Narrate at most one line between tool calls; post the owner a short status after the scan launches, when the scanners are back, after the consolidation, and with the PR. Stop the preview when the run ends.
