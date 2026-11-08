---
name: architecture-review
description: Use when the owner asks to review the architecture, structure or consistency of the app or a part of it against software design best practices, or to find cleanup and alignment work. Review only, no code changes: a map, parallel single-angle reviewers, a checked TL;DR, and a report PR whose findings are ready-made requests for the build skill.
---

# Review the architecture

You are the **coordinator**, the top-level session. You write the map, launch the reviewers as subagents (Claude Code: the Agent tool, all in one message), verify what they return, write the TL;DR and have it checked, and open the report as a PR. You change no code. The prompts for every subagent are in [briefs.md](briefs.md). Project rules come from CLAUDE.md; read it first.

The code is written and maintained by agents, so the review optimises for them: one obvious home per kind of thing, names an agent would grep for, small files, rules enforced by lints rather than prose, and CLAUDE.md as the navigation page. Clear boundaries, DRY, easy to maintain, consistent in code and in UI and UX.

## Scope

The owner names the scope when starting the run: the whole app, an area (`apps/mobile/src/sync` with `library`; the mobile `features` with `components`, `hooks`, `lib` and `utils`; `apps/server` with `packages/shared`), or one feature. Depth comes from a narrower scope, not from more reviewers. A question ("is the contacts code put together right?") is not a run: answer it with one reviewer and a reply.

## Workspace

`.work/review-<slug>/` (slug: kebab-case from the scope; `.work/` is gitignored): `map.md`, `reports/<angle>.md`, `tldr-check.md`, and `dropped.md`, one line per finding you dropped and why. The report itself goes into the repo (step 6).

## Steps

### 1. Map

Read CLAUDE.md, `docs/sync-design.md` §8 and §12, the `squidbox-ui` skill's conflicts table, and every earlier report in `docs/reviews/`. Run the three counts over the scope and keep the commands you used:

- the import matrix between top-level folders (feature → feature, `utils`/`hooks`/`components` → `features`, `utils` → `library`), as `rg -o "from '(\.\./)+[a-z-]+/[a-z-]+" ...` or equivalent, aggregated per folder pair;
- `catch` sites per folder;
- files over 300 lines.

Dispatch the map writer ([briefs.md](briefs.md), "Map") for the whole scope, or write the map yourself when the scope is one feature. The map is one page: every folder with a one-sentence responsibility, who depends on whom, where each kind of thing lives today (contexts, hooks, helpers, actions, web and native variants), and the three counts as the baseline. Save it as `map.md`.

### 2. Review

Launch the reviewers together, in one message, each with a fresh context, read-only, on the thorough model: **Homes and boundaries**, **Duplication and depth**, **Data integrity**, **Discoverability by task** (two or three task agents, see the brief), and **UX parity** when the scope has screens. Each gets the scope, `map.md` and its brief; the task agents get no map. If the owner named an extra focus when starting the run, append it to every brief under "Additional focus". Each reviewer writes `reports/<angle>.md` and returns one line.

### 3. Verify

Do what `/simplify`'s main agent does: check every finding against the code before you keep it. Four questions, each a reason to drop:

- **Grounded**: the code does what the finding says. Open the file.
- **Deliberate**: not something CLAUDE.md, `docs/sync-design.md` §12, `docs/library-ownership-plan.md`, the `squidbox-ui` conflicts table or an earlier report decided on purpose.
- **Needed**: a caller has the case; the fix is not for a situation nobody has.
- **Better**: deleting the abstraction and inlining its callers would not be smaller and clearer; the fix leaves fewer places to change, not different ones.

Merge duplicates across angles. Write dropped findings to `dropped.md`, one line each; do not argue with them. Turn each task agent's stalls into findings (a missing pointer in CLAUDE.md, a name nobody would grep for, two homes for one thing, a file too long to read).

### 4. TL;DR, and its check

Write half a page: what the review wants to change, in order, and why each change makes the code easier for an agent to maintain, with the evidence each claim rests on. Then dispatch the TL;DR checker ([briefs.md](briefs.md), "TL;DR check"); it returns one line per claim, holds or not and why. Rewrite or drop what did not hold, and note the ruling in `dropped.md`. One agent, one round.

### 5. Report

Write `docs/reviews/<date>-<scope>.md` in this order:

1. **TL;DR**, as checked.
2. **Map**, from `map.md`, baseline counts included.
3. **Findings**, one ordered list, most valuable first. Each is written as a build request and can be pasted into a build thread unchanged: what is wrong; the evidence (`file:line` or a count with its command); the fix as a target shape in one line; the files it touches; size S (under an hour), M (half a day) or L (a day or more); for whom (owner, agent, both); the test that covers the behaviour, or that none does. A finding that must land before another says so in its text.
4. **Enforce**: the lints and checks that would prevent a class of finding. Each entry has the eslint rule or one-line command, how many hits it has today, and whether it is an S finding of its own or needs the owner's decision first (a boundary rule CLAUDE.md does not have yet). A rule no lint can carry goes here too, marked as a CLAUDE.md candidate for the `add-rule` skill; the owner decides.
5. **Checked and sound**: what was tested against which scenario or rule and found fine, so the next run skips it.

### 6. Ship

Push a branch and open the PR with the TL;DR as its body. Tell the owner: the PR link, the TL;DR, and the question which findings to build. Then stop; this is the one place the run asks.

### 7. Hand off

Each finding the owner picks becomes a new build thread (ask the project coordinator for it, or the owner starts it), with the finding as the request and a `Context:` line naming the report's path in the repo. Findings that share files go one PR at a time, each after the owner's merge; independent ones may run as parallel branches. The next run of the same scope reads the merged report first and diffs the baseline counts.

## Rules

- Thorough model for every subagent; set it on each dispatch.
- Reviewers report, they never edit. You verify, you never skip the verification to save time.
- A finding without a nameable cost is not a finding. What a lint, the typecheck or knip already enforces is not a finding.
- The report records nothing in `todo.md` or CLAUDE.md on its own; those are the owner's calls, through the Enforce list.
- Narrate at most one line between tool calls; post the owner a short status after the map, the reviews, the TL;DR check and the PR.
