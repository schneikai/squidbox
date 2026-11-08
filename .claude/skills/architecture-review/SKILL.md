---
name: architecture-review
description: Use when the owner asks to review the architecture, structure or consistency of the app or a part of it against software design best practices, or to find cleanup and alignment work. Changes no feature code: a map, parallel single-angle reviewers, a checked TL;DR, and one PR with the report and the lint rules that keep its findings from coming back; the findings are ready-made requests for the build skill.
---

# Review the architecture

You are the **coordinator**, the top-level session. You write the map, launch the reviewers as subagents (Claude Code: the Agent tool, all in one message), merge and check what they return, write the TL;DR and have it checked, add the enforcement, and open the PR. The prompts for every subagent are in [briefs.md](briefs.md). Project rules come from CLAUDE.md.

The code is written and maintained by agents, so the review optimises for the cost and risk of the next agent change, not for how the code looks. An agent has no memory between sessions, a bounded context, strong grep, and copies the nearest pattern. So, in order: a rule holds only when a lint, the typecheck or a test enforces it, and CLAUDE.md is the routing table, not the rule book; an agent finds the right code (one obvious home per kind of thing, names it would grep for); a typical change touches little unrelated code; checks are fast and deterministic, or agents skip them; a bad change fails loudly and close to its cause, never behind a fallback; tests are the contract, since nobody reads the code, and the owner reads only the TL;DR in the thread, never the PR; one wrong example gets copied twenty times, so consistency beats cleverness. Duplication is a finding only when the copies must change together or a third copy appears; a small file is a proxy, not a goal; an extension point counts only where a change has already asked for it. A rare sync failure that loses data outweighs any amount of cleanup, so the review keeps two lists and never lets the easy-to-count one crowd out the other: **risks** to correctness, which need tests, and **friction** in agent changes, which needs structure. Severity order: data safety, then regression prevention, then change reliability, then discoverability, then structural consistency.

## Scope

The owner names the scope when starting the run: the whole app, an area (`apps/mobile/src/sync` with `library`; the mobile `features` with `components`, `hooks`, `lib` and `utils`; `apps/server` with `packages/shared`), or one feature. Depth comes from a narrower scope, not from more reviewers. A question ("is the contacts code put together right?") is not a run: answer it yourself.

## Workspace

`.work/review-<slug>/` (slug: kebab-case from the scope; `.work/` is gitignored): `map.md`, `reports/<angle>.md`, `tldr.md`, `tldr-check.md`, and `dropped.md`, one line per finding or TL;DR claim you dropped and why. The report itself goes into the repo (step 5).

## Steps

### 1. Map

Read CLAUDE.md, `docs/sync-design.md` §8 and §12, `docs/library-ownership-plan.md`, the `squidbox-ui` skill's conflicts table, and every earlier report in `docs/reviews/`. Run the counts over the scope; each goes into the map with the command that produced it:

- the import matrix between top-level folders (feature → feature, `utils`/`hooks`/`components` → `features`, `utils` → `library`), aggregated per folder pair;
- `catch` sites per folder;
- files over 300 lines (the run's own cut-off; CLAUDE.md sets none);
- the recent changes: the last five PRs merged into main (`git log --first-parent --merges` or the squashed commits), each with the folders its diff touched (`git show --stat`), and the fix-up PRs or commits that followed it (what review or a bug caught after it landed).

Dispatch the map writer ([briefs.md](briefs.md), "Map") for the whole scope, or write the map yourself when the scope is one feature; the brief says what the map holds. Save it as `map.md`. When an earlier report exists, diff its baseline counts against the new ones and note what moved, and for each of its findings that was built (its target shape is now in the code), note whether the count it predicted moved. Real changes are the review's primary evidence; the counts and the scenarios support them.

### 2. Review

Launch the reviewers together, in one message, each with a fresh context, read-only: **Homes and boundaries**, **Data integrity**, **Discoverability by task** (three task agents, see the brief), and **UX parity** when the scope has screens. Each gets the scope, `map.md` and its brief; the brief's common tail carries the verify criteria, so each reviewer checks its own findings before it returns. If the owner named an extra focus when starting the run, put it in the common tail's `[ADDITIONAL_FOCUS]`. Each reviewer writes `reports/<angle>.md` and returns one line.

### 3. Merge and check

Merge duplicates across angles (Homes and Discoverability both find two homes for one thing). Sort what is left into risks (Data integrity's findings, and anything else that can lose or corrupt data or ship a regression) and friction (everything else). Rank risks by what is lost and how often, friction by cost per change. Keep at most ten in all, risks first, and check each kept finding against the code yourself: open the file, then apply the criteria from the common tail. Drop a finding that fails one; write it to `dropped.md`, one line, and do not argue with it. Turn each task agent's stalls into findings in the common tail's shape (a missing pointer in CLAUDE.md, a name nobody would grep for, two homes for one thing, a file too long to read).

### 4. TL;DR, and its check

Write `tldr.md`, half a page, for an owner who reads no code: the risks first, then the friction, each numbered like the findings (R1, F1), why each change makes the code easier for an agent to maintain, what it costs (size, what could break), the evidence each claim rests on and the count it predicts, and what now gets enforced. No file paths in the TL;DR; those are in the findings. Then dispatch the TL;DR checker ([briefs.md](briefs.md), "TL;DR check"); it reads the code behind each claim and returns one line per claim, holds or not and why. Rewrite or drop what did not hold, and note the ruling in `dropped.md`. One agent, one round.

### 5. Report

Write `docs/reviews/<date>-<slug>.md` in this order:

1. **TL;DR**, as checked.
2. **Map**, from `map.md`, baseline counts included.
3. **Risks** (R1, R2, ...), then **Friction** (F1, F2, ...), each ranked as in step 3, each with the fields of the common tail in [briefs.md](briefs.md). Each is a complete build request; a risk's fix is first of all the test that covers the scenario. A finding that must land before another says so in its text.
4. **Enforce**: the lints and checks that keep a class of finding from coming back. Each entry has the eslint rule or one-line check, how many hits it has today, and whether it shipped in step 6. A rule CLAUDE.md does not state yet is a new constraint: it is an F finding with the rule in plain words, built only when the owner picks it, never shipped by the run, however small; it goes into the TL;DR as a question.
5. **Outcomes**, when an earlier report exists: each of its findings that was built, the count it predicted, the count today, and what happened to changes in that area since: the fix-ups and failed checks the map lists for them. Fewer corrections after the change is the outcome; a moved count is only the signal. A prediction that did not hold is a lesson for the next run's check step, written in one line.

### 6. Enforce

Add every Enforce entry that carries a rule CLAUDE.md or a design doc already states, the way the repo does it: a rule in `apps/mobile/.eslintrc.js` (`no-restricted-syntax`, `no-restricted-imports`) or a script beside `scripts/checkNewFiles.mjs` that `npm run check` and CI run. Fix today's hits when that is under an hour in total; otherwise mark each kept hit with an `eslint-disable-next-line` comment that says why, as the spacing rule does, so the count cannot grow unseen. The rule exists already, so the marks record exceptions to it, not a new policy. Run `npm run check`. This is the run's only change to code; feature code is for the build skill.

### 7. Ship

Commit the report and the enforcement on a branch `review-<slug>` (unless the environment already put you on a branch for this work), push it and open the PR with the TL;DR as its body. Tell the owner: the TL;DR in full (it is the only thing they read), the PR link, and the question which numbers to build; recommend the risks. Then stop; this is the one place the run asks.

### 8. Hand off

The owner answers with numbers. Each becomes a build thread whose request is one line: "Build finding N of docs/reviews/<date>-<slug>.md"; the build skill reads the finding there.

## Rules

- Thorough model (`fable` in Claude Code today) for every subagent; set it on each dispatch.
- The run never writes `todo.md` or CLAUDE.md. A new rule is a finding; the build that implements it adds its line through the `add-rule` skill.
- The briefs name folders, item kinds, scenarios and tasks as they are today; the map is the truth. Swap a scenario or task that no longer fits the map and say so in the report.
- Narrate at most one line between tool calls; post the owner a short status after the map, the reviews, the TL;DR check and the PR.
