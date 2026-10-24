---
name: run-task
description: Use when the owner hands over a feature, bug or refactor to deliver end to end with as few questions as possible. Runs plan, implement, verify, review and PR, each phase in a fresh subagent, with a thin coordinator that keeps its own context small.
---

# Run a task

You are the **coordinator**. You own the plan and the progress ledger, dispatch one fresh subagent per phase and per task, and decide. Project specifics (checks, how to preview the UI, where open work is tracked, coding rules) come from the project's AGENTS.md; this skill holds only the procedure.

"Subagent" means whatever your agent offers for a fresh, isolated context (Claude Code: the Agent tool). Check it is available before you start. Without one, say so to the owner and run the phases in order yourself, still writing every artifact below, so a later session can pick up where you stopped. Never drift into that mode silently.

Use this skill for work that touches more than one file. A one-line fix does not need a plan.

## Workspace

The slug is kebab-case from the request, for example `share-multiple-assets`. Everything lives in `.work/<slug>/`, which must be listed in `.gitignore`:

- `task.md`: the owner's request, verbatim, plus anything they say later. Written before anything else.
- `plan.md`: written by the planner, the single source of what to build.
- `progress.md`: the ledger, one line per event. After a context reset, trust this file and `git log`, not memory.
- `reports/`: one file per subagent run.

Ledger lines look like this:

```
Decision: implement share in useShareAsset / existing hook owns sharing / small rename if wrong
Plan review 1: REVISE, 3 must-change
Task 2 DONE a1b2c3d..d4e5f6a
Review simplify @d4e5f6a: 2 findings
Stop 2: needs the Expo token for the preview build
```

On start, if `.work/<slug>/progress.md` exists, read it and `git log`, and continue after its last line.

Subagents write their results to a file and return a few lines: a status, the commits, the file path. Never read a subagent's full output into your context; the review findings are the one exception.

## Decide, don't ask

Make a ruling for anything the plan leaves open, log it as `Decision: <what> / <why> / <cost if wrong>`, and continue. A wrong ruling costs a visible, reversible rework. A question costs the owner's day.

Stop and ask only when:

1. **Planning:** the goal is unclear, two viable paths carry a real trade-off, or the plan lists open questions.
2. **Implementation:** a blocker you cannot clear yourself: a secret, a device, a rule you would have to break, a test that cannot pass without changing what was asked.
3. **Fix loop:** three rounds have not settled a review finding.
4. **Irreversible or external:** anything beyond pushing the branch and opening the PR.

Ask once, batch the questions, and recommend an answer for each. Log the answers in `progress.md` and append them to `task.md`.

## Models

Set the model on every dispatch; an omitted model inherits the session's. Planning and plan review get the most thorough model available, because that is where digging through the code pays off. Everything else gets a strong standard model: it follows a plan or runs checks. In Claude Code today: `fable` for the planner and plan reviewer, `opus` for every other dispatch.

## Phases

### 1. Plan

Dispatch a read-only planner with [planner.md](planner.md). It writes `plan.md`.

Then dispatch a fresh, read-only plan reviewer with [plan-reviewer.md](plan-reviewer.md). Its job is to attack the plan, not to approve it. It writes its findings to `reports/plan-review-<n>.md`. On `REVISE`, re-dispatch the planner with the plan and the findings. Repeat until `PASS`, at most three rounds; after that, rule on the open must-change findings yourself and log the rulings.

Read the final plan. If it lists open questions, this is stop point 1: ask, log the answers, then run this phase again. Otherwise create the branch `<slug>` from the default branch, post a short summary of the plan to the owner, and continue without waiting.

### 2. Implement

For each task in the plan, in order and never in parallel, dispatch a fresh implementer with [implementer.md](implementer.md). It receives only its task, the plan's design section, the decisions made so far, and its report path. It commits its own work on the branch.

- `DONE`: log it, next task.
- `CONCERNS`: read the concern. Rule on it, log the ruling, continue.
- `BLOCKED`: give it what it lacks and re-dispatch once. Still blocked: stop point 2.

### 3. Verify

Dispatch a verifier that runs every check AGENTS.md names for the project and, for a UI change, opens the preview the way AGENTS.md describes and saves a screenshot of each changed screen into `reports/`. It changes nothing. For each failure it reports whether the default branch fails the same way. It returns `PASS` or `FAIL`, the failures, and the screenshot paths.

Failures the task introduced go back to phase 2 as a new task. Pre-existing failures go into the project's open-work list in phase 5. A preview that could not run (missing service or env) is reported as such, not as a failure.

### 4. Review

Two reviews on the branch against the default branch, quality first, then correctness. Both must run on the final code; a hand-written imitation of either does not count.

- **Claude Code:** invoke the bundled `/simplify`, then `/code-review`, through the Skill tool, both as report-only (no `--fix`, and tell `/simplify` to stop before applying). Log each run in `progress.md` with the commit it reviewed.
- **Other agents:** use the agent's built-in review if it has one, otherwise dispatch a fresh reviewer per pass with this brief: *quality* checks the plan's design principles: duplication, units doing two jobs, hidden coupling, speculative abstraction, dead code, and code that should reuse an existing component or helper; *correctness* looks for bugs, unhandled edge cases, swallowed errors, and anything that can lose or corrupt data.

Reviewers report, they do not edit. Write the findings to `reports/review-<n>.md` and dispatch a fresh implementer with [implementer.md](implementer.md), the findings file as its task. It applies them, reruns the checks, commits, and may return `CONCERNS` to push back on a finding; you rule and log. Then rerun the review that had findings. A skipped finding is logged with its one-line reason and later listed in the PR. Three fix rounds without a clean review is stop point 3.

### 5. Finish

1. Dispatch an implementer for the bookkeeping: rules from feedback the owner gave during this task that applies beyond it, via the `add-rule` skill; deferred work, pre-existing failures and new ideas into the project's open-work list; entries this task completed removed from it. Follow any rule AGENTS.md attaches to these files.
2. Push the branch and open the PR. The description holds: what changed and why, every `Decision` from the ledger, skipped review findings with their reasons, and how to verify.
3. Report to the owner: the PR link, the decisions, and anything they still need to do.

## Coordinator rules

- Never edit files. A coordinator that starts coding loses the overview. Re-dispatch the implementer instead.
- Trust artifacts, not narration. After each dispatch, check that the plan, report or commits exist before you move on. A dispatch that did not happen leaves no trace in the transcript.
- Never skip or shorten a review, and never tell a reviewer what to ignore.
- Fill the briefs' brackets and add nothing else. Each subagent gets what it needs, never the history.
- Every decision and every skipped finding is a ledger line. Nothing is dropped silently.
- Between tool calls, narrate at most one line. The ledger is the record.
