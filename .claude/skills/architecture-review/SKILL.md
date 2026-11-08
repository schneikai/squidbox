---
name: architecture-review
description: Use when the owner asks to review the architecture, structure or consistency of the app or a part of it against software design best practices, or to find cleanup and alignment work. Review only, no code changes: a map, parallel single-angle reviewers, a checked TL;DR, and a report PR whose findings are ready-made requests for the build skill.
---

# Review the architecture

You are the **coordinator**, the top-level session. You write the map, launch the reviewers as subagents (Claude Code: the Agent tool, all in one message), verify what they return, write the TL;DR and have it checked, and open the report as a PR. You change no code. The prompts for every subagent are in [briefs.md](briefs.md). Project rules come from CLAUDE.md.

The code is written and maintained by agents, so the review optimises for the cost and risk of the next agent change, not for how the code looks. In order: an agent finds the right code (one obvious home per kind of thing, names it would grep for, CLAUDE.md as the routing table, not the encyclopedia); a typical change touches little unrelated code; contracts are enforced by types, lints and schemas rather than remembered; tests catch the regression; a bad change fails visibly and close to its cause. Duplication is a finding only when the copies must change together; a small file is a proxy, not a goal; an extension point counts only where a change has already asked for it.

## Scope

The owner names the scope when starting the run: the whole app, an area (`apps/mobile/src/sync` with `library`; the mobile `features` with `components`, `hooks`, `lib` and `utils`; `apps/server` with `packages/shared`), or one feature. Depth comes from a narrower scope, not from more reviewers. A question ("is the contacts code put together right?") is not a run: answer it yourself.

## Workspace

`.work/review-<slug>/` (slug: kebab-case from the scope; `.work/` is gitignored): `map.md`, `reports/<angle>.md`, `tldr.md`, `tldr-check.md`, and `dropped.md`, one line per finding or TL;DR claim you dropped and why. The report itself goes into the repo (step 5).

## Steps

### 1. Map

Read CLAUDE.md, `docs/sync-design.md` §8 and §12, `docs/library-ownership-plan.md`, the `squidbox-ui` skill's conflicts table, and every earlier report in `docs/reviews/`. Run the three counts over the scope; each goes into the map with the command that produced it:

- the import matrix between top-level folders (feature → feature, `utils`/`hooks`/`components` → `features`, `utils` → `library`), aggregated per folder pair;
- `catch` sites per folder;
- files over 300 lines (the run's own cut-off; CLAUDE.md sets none);
- the recent changes: the last five PRs merged into main (`git log --first-parent --merges` or the squashed commits), each with the folders its diff touched (`git show --stat`), and the fix-up PRs or commits that followed it (what review or a bug caught after it landed).

Dispatch the map writer ([briefs.md](briefs.md), "Map") for the whole scope, or write the map yourself when the scope is one feature; the brief says what the map holds. Save it as `map.md`. When an earlier report exists, diff its baseline counts against the new ones and note what moved, and for each of its findings that was built (its target shape is now in the code), note whether the count it predicted moved. Real changes are the review's primary evidence; the counts and the scenarios support them.

### 2. Review

Launch the reviewers together, in one message, each with a fresh context, read-only: **Homes and boundaries**, **Duplication and depth**, **Data integrity**, **Discoverability by task** (three task agents, see the brief), and **UX parity** when the scope has screens. Each gets the scope, `map.md` and its brief. If the owner named an extra focus when starting the run, put it in the common tail's `[ADDITIONAL_FOCUS]`. Each reviewer writes `reports/<angle>.md` and returns one line.

### 3. Verify

Check every finding against the code before you keep it. Each of these is a reason to drop:

- **Grounded**: the code does what the finding says. Open the file.
- **Deliberate**: not something CLAUDE.md, `docs/sync-design.md` §12, `docs/library-ownership-plan.md`, the `squidbox-ui` conflicts table or an earlier report decided on purpose.
- **Needed**: a caller has the case; the fix is not for a situation nobody has.
- **Better**: deleting the abstraction and inlining its callers would not be smaller and clearer; the fix leaves fewer places to change, not different ones. Crossing folders is not a cost by itself: it is one when the folders are not boundaries a change needs.
- **Predicted**: it names the change that gets cheaper (a recent PR or a scenario) and what the next run can count to see it: folders that change touches, files a task agent reads, hits of a lint, or the test that would have caught a past fix-up.
- **Costed**: it names what gets harder or breaks.
- **Not enforced**: no lint, the typecheck or knip already catches it.

Merge duplicates across angles. Write dropped findings to `dropped.md`, one line each; do not argue with them. Turn each task agent's stalls into findings in the common tail's shape (a missing pointer in CLAUDE.md, a name nobody would grep for, two homes for one thing, a file too long to read).

### 4. TL;DR, and its check

Write `tldr.md`, half a page: what the review wants to change, in order, and why each change makes the code easier for an agent to maintain, with the evidence each claim rests on. Then dispatch the TL;DR checker ([briefs.md](briefs.md), "TL;DR check"); it returns one line per claim, holds or not and why. Rewrite or drop what did not hold, and note the ruling in `dropped.md`. One agent, one round.

### 5. Report

Write `docs/reviews/<date>-<slug>.md` in this order:

1. **TL;DR**, as checked.
2. **Map**, from `map.md`, baseline counts included.
3. **Findings**, one ordered list, most valuable first, each with the fields of the common tail in [briefs.md](briefs.md). Each is a build request and can be pasted into a build thread unchanged. A finding that must land before another says so in its text.
4. **Enforce**: the lints and checks that would prevent a class of finding. Each entry has the eslint rule or one-line command, how many hits it has today, and whether it is an S finding of its own or needs the owner's decision first (a boundary rule CLAUDE.md does not have yet). A rule no lint can carry goes here too, marked as a CLAUDE.md candidate for the `add-rule` skill; the owner decides.
5. **Outcomes**, when an earlier report exists: each of its findings that was built, the count it predicted, and the count today. A prediction that did not hold is a lesson for the next run's verify step, written in one line.
6. **Checked and sound**: what was tested against which scenario or rule and found fine, with the files it covered. The next run skips an entry only when those files did not change since; it is a note, not an exemption.

### 6. Ship

Commit the report on a branch `review-<slug>` (unless the environment already put you on a branch for this work), push it and open the PR with the TL;DR as its body. Tell the owner: the PR link, the TL;DR, and the question which findings to build. Then stop; this is the one place the run asks.

### 7. Hand off

Each finding the owner picks is a build request: the finding's text, plus a `Context:` line naming the report's path in the repo.

## Rules

- Thorough model (`fable` in Claude Code today) for every subagent; set it on each dispatch.
- The report records nothing in `todo.md` or CLAUDE.md on its own; those are the owner's calls, through the Enforce list.
- Narrate at most one line between tool calls; post the owner a short status after the map, the reviews, the TL;DR check and the PR.
