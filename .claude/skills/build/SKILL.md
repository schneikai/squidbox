---
name: build
description: Use when the owner hands over a feature, bug or refactor to deliver end to end with as few questions as possible. A thin coordinator runs plan, build, review and ship with a planner, a plan reviewer and one implementer as subagents and two reviewers it runs itself.
---

# Build a request

You are the **coordinator**, always the top-level session. You hold the plan and the ledger, dispatch the planner, the plan reviewer and the implementer as subagents (Claude Code: the Agent tool), run the quality and correctness reviewers yourself (they might spawn subagents, which only top-level sessions can do), and decide. Each phase has its own brief in this folder; the only difference is who runs it. Project specifics (checks, install, preview, coding rules, bookkeeping) come from CLAUDE.md. Read it before you start.

Use it for work that touches more than one file. A one-line fix does not need a plan.

## Workspace

`.work/<slug>/` (slug: kebab-case from the request; `.work/` in `.gitignore`, the implementer adds it if missing):

- `progress.md`: the ledger. It opens with the owner's request, verbatim, above a `---` line. Below, one line per event: `Base:`, `Branch:`, `Decision: what / why / cost if wrong`, `Dispatch: planner → plan.md`, `Build DONE a1b2c3d..d4e5f6a`, `Review quality: 3 findings`, `Stop:`, `Answer:`, `PR:`, `Feedback:`. The implementer appends `Note:` lines for what later steps must know.
- `plan.md`: written by the planner.
- `reports/`: one file per step: `plan-review`, `build`, `review-quality`, `fix-quality`, `review-correctness`, `fix-correctness`, `bookkeeping`.
- Everything else the run throws away (scripts, output) lives here too, for the owner to look at.

## Decide, don't ask

Rule on anything the plan leaves open, log it as a `Decision`, and continue. A wrong ruling costs a visible, reversible rework; a question costs the owner's day. Stop and ask only when:

1. the plan lists open questions (once per run; later questions become rulings),
2. the implementer is blocked by something only the owner has (a secret, hardware, a rule it would have to break),
3. the implementer declines a must-fix review finding and you cannot rule on it,
4. anything irreversible or external beyond pushing the branch and opening the PR.

Ask once, batch the questions, recommend an answer for each, log the answers.

The run is autonomous by default. Only when the owner asked, when starting it, to see the plan first: post the plan's Goal and Design with a link to `plan.md` after the plan review and wait. Their feedback goes to the planner as one more revision, then the build starts.

## Models

Thorough model for planning and plan review, standard model for the implementer, set explicitly on every dispatch. Claude Code today: `fable` and `opus`. If a dispatch rejects the model name, retry with the tool's default and log it.

## Steps

### 1. Plan

1. Planner ([planner.md](planner.md)) writes `plan.md`.
2. Plan reviewer ([plan-reviewer.md](plan-reviewer.md)) attacks it and writes `reports/plan-review.md`.
3. Planner revises once with that report; it returns one line per finding it declined. Rule on each and log it.
4. Plan reviewer looks once more, at its own must-change findings only: fixed in the revised plan, or not. What is not fixed goes to the planner with the plan's answers, or you rule on it.

If the plan has open questions, ask them (stop point 1) and let the planner revise once more with the answers. Then you create the branch, as you later push it: `git checkout -b <slug>`, unless the environment already put you on a branch for this work. Log `Branch:` and `Base:` (the branch it came from), tell the owner the plan's decisions, and continue.

### 2. Build

Dispatch the implementer ([implementer.md](implementer.md)). It builds the plan, commits as it goes, then runs the plan's done-check and the project checks and fixes what fails, writes `reports/build.md` and appends `Build DONE <first>..<last>` and a `Note:` line.

- `DONE`: review.
- `CONCERNS`: rule, log, continue the implementer only if something is incomplete.
- `BLOCKED`: if the ledger or plan holds what it lacks, continue the implementer once with it; otherwise stop point 2.

### 3. Review

You run both reviewers yourself, each through the agent's review skill, and the implementer applies the findings. Each review is report only and runs no checks; the implementer reruns the project checks after each fix round.

1. **Quality.** Run the quality reviewer ([quality-reviewer.md](quality-reviewer.md)); it writes `reports/review-quality.md`. Then continue the implementer: apply the findings it agrees with and rerun the project checks. Skip it when there is nothing to apply.
2. **Correctness.** Run the correctness reviewer ([correctness-reviewer.md](correctness-reviewer.md)); it writes `reports/review-correctness.md`. Continue the implementer: apply the must-fix findings and the nice-to-haves it agrees with, rerun the checks. Skip it when there is nothing to apply.

After each fix round the implementer returns one line per finding it skipped; rule on each. A finding you rule must be applied, skipped or nice-to-have, and a fix you want yourself, go back to the implementer as one more fix round. A must-fix you cannot rule on: stop point 3. Findings you skip are logged with a reason and listed in the PR.

### 4. Ship

1. If bookkeeping is missing (whatever CLAUDE.md asks for when a change is done), continue the implementer with it.
2. If the base moved on, continue the implementer: merge the base in, rerun the checks, commit. Then push the branch and open the PR against the base: what changed and why, the plan's Goal and Design, every `Decision`, skipped findings with reasons, the plan's Verification lines. A step CLAUDE.md attaches to a changed file that needs a tool the implementer lacks is yours, after the push, from the merged files.
3. Report to the owner: the PR link, the decisions, what is left for them to verify, and, only if the run turned any up, suggestions in plain words: rules the project should adopt, and open work it noticed. The run records neither anywhere; the owner decides, and whatever the project has for recording rules or open work (a file, a skill) comes into play only when they say so.

### 5. Feedback

The owner's feedback on the PR is part of the run. Each round goes to the implementer, or to the planner first when it changes the design; the implementer applies it, reruns the checks, commits and pushes, and you log `Feedback:` with what changed. No review runs on its own. When the rounds have changed more than a few lines, offer the owner one more review pass; run both reviews on the diff since the last review when they say yes, or whenever they ask.

## Rules

- Every decision and skipped finding is a ledger line. Narrate at most one line between tool calls.
- Post the owner a short status after every phase: the plan, the plan review, the revision, the build, each review, each fix round, bookkeeping, the push, each feedback round. What it produced, in numbers (commits, checks, findings applied and skipped), and the decisions you made in it.
