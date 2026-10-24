---
name: run-task
description: Use when the owner hands over a feature, bug or refactor to deliver end to end with as few questions as possible. A thin coordinator runs plan, build, review and ship, each step in a fresh subagent.
---

# Run a task

You are the **coordinator**, always the top-level session. You hold the plan and the ledger, dispatch planning and building to fresh subagents (Claude Code: the Agent tool), run the review passes yourself, and decide. You never edit files outside `.work/`; a coordinator that starts coding loses the overview. Project specifics (checks, install, preview, coding rules, where open work is tracked) come from CLAUDE.md.

Use it for work that touches more than one file. A one-line fix does not need a plan.

## Workspace

`.work/<slug>/` (slug: kebab-case from the request; `.work/` in `.gitignore`, the first implementer adds it if missing):

- `progress.md`: the ledger. It opens with the owner's request, verbatim, above a `---` line. Below, one line per event: `Preflight:`, `Base:`, `Branch:`, `Decision: what / why / cost if wrong`, `Dispatch: planner → reports/plan.md`, `Task 2 DONE a1b2c3d..d4e5f6a`, `Review quality: 3 findings`, `Stop:`, `Answer:`, `PR:`. Implementers append `Note:` lines for what later steps must know.
- `plan.md`: written by the planner.
- `reports/`: one file per dispatch, named after it: `plan-review`, `build`, `review-quality`, `fix-quality`, `review-correctness`, `fix-correctness`, `review-confirm`, `bookkeeping`.
- Everything else the run throws away (scripts, screenshots) lives here too, for the owner to look at.

Subagents write their result to a file and return a few lines: status, commits, file path. You read `plan.md` once and the ledger; never a report, apart from the review reports you write yourself.

After a context reset, read the ledger and `git log` and continue after the last line. Modified tracked files mean the last dispatch died: the next implementer first commits or discards them. A commit for task N without a `Task N DONE` line: re-dispatch the build from task N with "commit X already holds work for this task; verify it, finish or amend".

## Decide, don't ask

Rule on anything the plan leaves open, log it as a `Decision`, and continue. A wrong ruling costs a visible, reversible rework; a question costs the owner's day. Stop and ask only when:

1. the plan lists open questions or the preflight found something only the owner can supply (once per run; later questions become rulings),
2. an implementer is blocked by something only the owner has (a secret, a device, a rule it would have to break),
3. a must-fix review finding is still open after the fix round and you cannot rule on it,
4. anything irreversible or external beyond pushing the branch and opening the PR.

Ask once, batch the questions, recommend an answer for each, log the answers.

One question is always asked, at the start: build straight away (the recommended answer), or present the plan first? If the owner wants to see it, post the plan's Goal and task list with a link to `plan.md` after the plan review and wait. Their feedback goes to the planner as one more revision, then the build starts.

## Models

Thorough model for planning and plan review, standard model for everything else, set explicitly on every dispatch. Claude Code today: `fable` and `opus`. If a dispatch rejects the model name, retry with the tool's default and log it.

## Steps

### 0. Preflight

Check, without fixing code: clean working tree, git identity set, dependencies installed (CLAUDE.md names the install; run it if not), and whether the project's preview can run (CLAUDE.md names its prerequisites). Log `Preflight: preview yes|no (reason)`. Base is the branch checked out now, or the default branch when detached; `git fetch origin <base>` and log `Base:`. If the environment names a branch you must work on, that is the task branch.

### 1. Plan

1. Planner ([planner.md](planner.md)) writes `plan.md`.
2. Plan reviewer ([plan-reviewer.md](plan-reviewer.md)) attacks it and writes `reports/plan-review.md`.
3. Planner revises once with that report; it returns one line per finding it declined. Rule on each and log it.

If the plan has open questions: stop point 1, then one more planner revision with the answers. Then create the branch `<slug>` from the base (`<slug>-2` if taken) unless the environment named one, log `Branch:`, post the plan's decisions to the owner, and continue.

### 2. Build

One implementer ([implementer.md](implementer.md)) does the plan's tasks in order: one commit per task after its done-check, one `Task N DONE` line in the ledger each, a `Note:` line for what later steps must know.

- `DONE`: review.
- `CONCERNS`: rule, log, re-dispatch from the first incomplete task only if something is incomplete.
- `BLOCKED`: if the ledger or plan holds what it lacks, re-dispatch from that task once with it; otherwise stop point 2.

### 3. Review

Reviews report, implementers fix. You run each review pass yourself, following [reviewer.md](reviewer.md) with its brackets filled, and write the report; the review skills fan out only from the top-level session (Claude Code, October 2026: a subagent cannot spawn subagents, so a dispatched reviewer gets a single-pass review). The project checks run in the fix implementers only, so at most twice; build implementers run their done-check and reviews run nothing.

1. **Quality** (quality focus; Claude Code: `/simplify`, told to report only). An implementer applies the findings it agrees with and runs the checks on the whole branch for the first time. Dispatch it even with no findings, for that run.
2. **Correctness** (correctness focus; `/code-review medium`). An implementer applies the must-fix findings and the nice-to-haves it agrees with, and runs the checks again. Skip it when there is nothing to apply.
3. **Confirm** (correctness focus again, with the previous report, the fix commits and your rulings; `/code-review low`). Skip it when step 2 was skipped. It reports only fixes not applied and regressions in the fix commits; anything else is logged for the PR. A must-fix still open that you cannot rule on: stop point 3.

A fix implementer returns one line per finding it skipped; rule on each. Findings you skip are logged with a reason, passed to the next reviewer as ruled, and listed in the PR.

### 4. Ship

1. One last implementer does the bookkeeping still missing: a rule from owner feedback via the `add-rule` skill, open-work entries (the plan's Open work section, pre-existing failures from the fix reports), screenshots of the plan's listed screens that no done-check took. Skip it when nothing is missing.
2. Push the branch and open the PR against the base: what changed and why, the plan's Goal and Design, every `Decision`, skipped findings with reasons, how to verify. A step CLAUDE.md attaches to a changed file that needs a tool implementers lack (publishing a page, for one) is yours, after the push.
3. Report to the owner: the PR link, the decisions, and the screenshots (attached when the session can attach files, else their path).

Now and then, offer the owner a short spike: if a subagent can spawn subagents again, the review passes go back to dispatched reviewers.

## Rules

- Never edit files outside `.work/`; re-dispatch an implementer instead. A review skill that edits anyway is reverted, its diff kept as findings.
- Trust artifacts, not narration: after each dispatch, check that its file or commits exist and `git status --porcelain` is empty.
- Fill the briefs' brackets and add nothing; a subagent gets paths, not history.
- Never shorten a review or tell a reviewer what to ignore.
- Every decision and skipped finding is a ledger line. Narrate at most one line between tool calls.
