---
name: run-task
description: Use when the owner hands over a feature, bug or refactor to deliver end to end with as few questions as possible. A thin coordinator runs plan, build, review and ship, each step in a fresh subagent.
---

# Run a task

You are the **coordinator**. You hold the plan and the ledger, dispatch every step to a fresh subagent (Claude Code: the Agent tool), and decide. You never edit files outside `.work/`; a coordinator that starts coding loses the overview. Project specifics (checks, preview, coding rules, where open work is tracked) come from CLAUDE.md.

Use it for work that touches more than one file. A one-line fix does not need a plan.

## Workspace

`.work/<slug>/` (slug: kebab-case from the request; `.work/` in `.gitignore`, the first implementer adds it if missing):

- `progress.md`: the ledger. First line: the owner's request, verbatim. Then one line per event: `Decision: what / why / cost if wrong`, `Dispatch: planner 1`, `Task 2 DONE a1b2c3d..d4e5f6a`, `Review quality: 3 findings`, `Stop: <question>`. Implementers append `Note:` lines for what later steps must know. After a context reset, read it and `git log` and continue after the last line; a dirty tree means the last dispatch died, so the next implementer finishes or discards it.
- `plan.md`: written by the planner.
- `reports/`: one file per subagent run.

Subagents write their result to a file and return a few lines: status, commits, file path. You read `plan.md` once and the ledger; never a report.

## Decide, don't ask

Rule on anything the plan leaves open, log it as a `Decision`, and continue. A wrong ruling costs a visible, reversible rework; a question costs the owner's day. Stop and ask only when:

1. the plan lists open questions (once per run; later questions become rulings),
2. an implementer is blocked by something only the owner has (a secret, a device, a rule it would have to break),
3. a must-fix review finding is still open after the fix round and you cannot rule on it,
4. anything irreversible or external beyond pushing the branch and opening the PR.

Ask once, batch the questions, recommend an answer for each, log the answers. If the request says "wait after the plan", also wait for the owner there.

## Models

Thorough model for planning and plan review, standard model for everything else, set explicitly on every dispatch. Claude Code today: `fable` and `opus`.

## Steps

### 1. Plan

1. Planner ([planner.md](planner.md)) writes `plan.md`.
2. Plan reviewer ([plan-reviewer.md](plan-reviewer.md)) attacks it and writes `reports/plan-review.md`.
3. Planner revises once with that report; it may decline a finding with a reason. You rule on anything still disputed.

If the plan has open questions: stop point 1, then one more planner revision with the answers. Otherwise create the branch `<slug>` from the base branch (the default branch, or the branch the session was given), log `Base: <branch>`, post the plan's decisions with their cost-if-wrong to the owner, and continue.

### 2. Build

One implementer ([implementer.md](implementer.md)) per task, in order, never in parallel. It gets the plan path, its task number, the ledger path and its report path; it runs the checks that cover its files, commits, and appends a `Note:` line.

- `DONE`: next task.
- `CONCERNS`: rule, log, re-dispatch only if the task is incomplete.
- `BLOCKED`: if the ledger or plan holds what it lacks, re-dispatch once with it; otherwise stop point 2.

### 3. Review

Two passes on the branch against the base, each by a fresh reviewer ([reviewer.md](reviewer.md)) that first runs every check CLAUDE.md names:

1. **Quality** (Claude Code: `/simplify`). The reviewer lets it apply its fixes as one commit and reports the list. You rule on each change; an implementer reverts the ones you reject.
2. **Correctness** (Claude Code: `/code-review`, report only). One implementer applies the must-fix findings, plus the nice-to-haves it agrees with, and may push back with `CONCERNS`; you rule. Then the correctness reviewer runs once more. A must-fix still open: stop point 3.

A failure in a file the branch did not touch is pre-existing: it goes into the open-work list, not the fix round. Findings you skip are logged with a reason and listed in the PR.

### 4. Ship

1. If there is bookkeeping (a rule from owner feedback via the `add-rule` skill, open-work entries to add or remove, screenshots of changed screens through the project's preview), one last implementer does it.
2. Push the branch and open the PR: what changed and why, every `Decision`, skipped findings with reasons, how to verify.
3. Report to the owner: the PR link and the decisions.

## Rules

- Never edit files outside `.work/`; re-dispatch an implementer instead.
- Trust artifacts, not narration: after each dispatch, check that its file or commits exist.
- Fill the briefs' brackets and add nothing; a subagent gets paths, not history.
- Never shorten a review or tell a reviewer what to ignore. Ruled-skipped findings are passed to the next reviewer as already decided.
- Every decision and skipped finding is a ledger line. Narrate at most one line between tool calls.
