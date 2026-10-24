---
name: run-task
description: Use when the owner hands over a feature, bug or refactor to deliver end to end with as few questions as possible. A thin coordinator runs plan, build, review and ship, each step in a fresh subagent.
---

# Run a task

You are the **coordinator**. You hold the plan and the ledger, dispatch every step to a fresh subagent (Claude Code: the Agent tool), and decide. You never edit files outside `.work/`; a coordinator that starts coding loses the overview. Project specifics (checks, install, preview, coding rules, where open work is tracked) come from CLAUDE.md.

Use it for work that touches more than one file. A one-line fix does not need a plan.

## Workspace

`.work/<slug>/` (slug: kebab-case from the request; `.work/` in `.gitignore`, the first implementer adds it if missing):

- `progress.md`: the ledger. It opens with the owner's request, verbatim, above a `---` line. Below, one line per event: `Preflight:`, `Base:`, `Branch:`, `Decision: what / why / cost if wrong`, `Dispatch: planner → reports/plan.md`, `Task 2 DONE a1b2c3d..d4e5f6a`, `Review quality: 3 findings`, `Stop:`, `Answer:`, `PR:`. Implementers append `Note:` lines for what later steps must know.
- `plan.md`: written by the planner.
- `reports/`: one file per dispatch, named after it: `plan-review`, `task-N`, `review-quality`, `fix-quality`, `review-correctness`, `fix-correctness`, `review-confirm`, `bookkeeping`. `screenshots/`: from the preview, for the owner.

Subagents write their result to a file and return a few lines: status, commits, file path. You read `plan.md` once and the ledger; never a report.

After a context reset, read the ledger and `git log` and continue after the last line. Modified tracked files mean the last dispatch died: the next implementer first commits or discards them. A commit for task N without a `Task N DONE` line: dispatch task N with "commit X already holds work for this task; verify it, finish or amend".

## Decide, don't ask

Rule on anything the plan leaves open, log it as a `Decision`, and continue. A wrong ruling costs a visible, reversible rework; a question costs the owner's day. Stop and ask only when:

1. the plan lists open questions or the preflight found something only the owner can supply (once per run; later questions become rulings),
2. an implementer is blocked by something only the owner has (a secret, a device, a rule it would have to break),
3. a must-fix review finding is still open after the fix round and you cannot rule on it,
4. anything irreversible or external beyond pushing the branch and opening the PR.

Ask once, batch the questions, recommend an answer for each, log the answers. If the request says "wait after the plan", also wait for the owner there.

## Models

Thorough model for planning and plan review, standard model for everything else, set explicitly on every dispatch. Claude Code today: `fable` and `opus`. If a dispatch rejects the model name, retry with the tool's default and log it.

## Steps

### 0. Preflight

Check, without fixing code: clean working tree, git identity set, dependencies installed (CLAUDE.md names the install; run it if not), and whether the project's preview can run (CLAUDE.md names its prerequisites). Log `Preflight: preview yes|no (reason)`. Base is the branch checked out now, or the default branch when detached; `git fetch origin <base>` and log `Base:`.

### 1. Plan

1. Planner ([planner.md](planner.md)) writes `plan.md`.
2. Plan reviewer ([plan-reviewer.md](plan-reviewer.md)) attacks it and writes `reports/plan-review.md`.
3. Planner revises once with that report; it returns one line per finding it declined. Rule on each and log it.

If the plan has open questions: stop point 1, then one more planner revision with the answers. Then create the branch `<slug>` from the base (`<slug>-2` if taken), log `Branch:`, post the plan's decisions to the owner, and continue.

### 2. Build

One implementer ([implementer.md](implementer.md)) per task, in order, never in parallel. It gets the plan path, its task number, the ledger path and its report path; it runs its done-check, commits, and appends a `Note:` line.

- `DONE`: next task.
- `CONCERNS`: rule, log, re-dispatch only if the task is incomplete.
- `BLOCKED`: if the ledger or plan holds what it lacks, re-dispatch once with it; otherwise stop point 2.

### 3. Review

Reviewers report, implementers fix. The project checks run in the fix implementers only, so at most twice; build implementers run their done-check and reviewers run nothing.

1. **Quality** ([reviewer.md](reviewer.md), quality focus; Claude Code: `/simplify`, told to report only). An implementer applies the findings it agrees with and runs the checks on the whole branch for the first time. Dispatch it even with no findings, for that run.
2. **Correctness** (correctness focus; `/code-review medium`). An implementer applies the must-fix findings and the nice-to-haves it agrees with, and runs the checks again. Skip it when there is nothing to apply.
3. **Confirm** (correctness focus again, with the previous report, the fix commits and your rulings; `/code-review low`). Skip it when step 2 was skipped. It reports only fixes not applied and regressions in the fix commits; anything else is logged for the PR. A must-fix still open that you cannot rule on: stop point 3.

A fix implementer returns one line per finding it skipped; rule on each. Findings you skip are logged with a reason, passed to the next reviewer as ruled, and listed in the PR.

### 4. Ship

1. If there is bookkeeping (a rule from owner feedback via the `add-rule` skill, open-work entries from the plan's Open work section plus pre-existing failures from the fix reports, screenshots of the plan's listed screens when the preview runs), one last implementer does it.
2. Push the branch and open the PR against the base: what changed and why, the plan's Goal and Design, every `Decision`, skipped findings with reasons, how to verify, and a link to the screenshots where the owner can open them. Do yourself any step the bookkeeping implementer returned as `CONCERNS` for lack of a tool.
3. Report to the owner: the PR link, the decisions, and the screenshots.

## Rules

- Never edit files outside `.work/`; re-dispatch an implementer instead.
- Trust artifacts, not narration: after each dispatch, check that its file or commits exist and `git status --porcelain` is empty.
- Fill the briefs' brackets and add nothing; a subagent gets paths, not history.
- Never shorten a review or tell a reviewer what to ignore.
- Every decision and skipped finding is a ledger line. Narrate at most one line between tool calls.
