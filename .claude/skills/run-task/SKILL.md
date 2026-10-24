---
name: run-task
description: Use when the owner hands over a feature, bug or refactor to deliver end to end with as few questions as possible. Runs plan, implement, verify, review and PR, each phase in a fresh subagent, with a thin coordinator that keeps its own context small.
---

# Run a task

You are the **coordinator**. You own the plan and the progress ledger, dispatch one fresh subagent per phase and per task, and decide. You never edit source files yourself: a coordinator that starts coding loses the overview, and that is where cross-layer bugs come from.

"Subagent" means whatever your agent offers for a fresh, isolated context (Claude Code: the Agent tool). Check it is available before you start. Without one, say so to the owner and run the phases in order yourself, still writing every artifact below, so a later session can pick up where you stopped. Never drift into that mode silently.

Use this skill for work that touches more than one file. A one-line fix does not need a plan. If the plan ends up with more than eight tasks, split the work into phased PRs.

## Workspace

Everything lives in `.work/<task-slug>/` (gitignored):

- `plan.md`: written by the planner, the single source of what to build.
- `progress.md`: the ledger. One line per event: task done (commit range), decision, review verdict, stop point. After a context reset, trust this file and `git log`, not memory.
- `reports/`: one file per implementer and verifier run.

Subagents write their results to a file and return at most 10 lines: a status, the commits, and the file path. Never paste a subagent's full output into your context.

## Decide, don't ask

Make a ruling for anything the plan leaves open, log it as `Decision: <what> / <why> / <cost if wrong>`, and continue. A wrong ruling costs a visible, undoable rework. A question costs the owner's day.

Stop and ask only when:

1. **Planning:** the goal is unclear, or two viable paths carry a real trade-off, or the right fix is far bigger than what was asked.
2. **Implementation:** a blocker you cannot clear yourself: a secret, a device, a rule you would have to break, a test that cannot pass without changing what was asked.
3. **Fix loop:** three rounds have not settled a review finding.
4. **Irreversible or external:** anything beyond pushing the branch and opening the PR.

Ask once, batch the questions, and recommend an answer for each. Log the answer in `progress.md`.

## Models

Set the model on every dispatch; an omitted model inherits the session's. Planning and plan review get the most thorough model available, because that is where digging through the code pays off. Implementation, verification and the coordinator itself get a strong standard model: they follow a plan or read short reports. In Claude Code today: `fable` for the planner and plan reviewer, `opus` for everything else, including the session running this skill.

## Phases

### 1. Plan

Dispatch a read-only planner with [planner.md](planner.md). It reads AGENTS.md, `todo.md` and the code, and writes `plan.md`.

Then dispatch a fresh, read-only plan reviewer with [plan-reviewer.md](plan-reviewer.md). Its job is to attack the plan, not to approve it. It writes its findings to `reports/plan-review-<n>.md`. Give the findings path to the planner (resume it, or re-dispatch with the plan and the findings) and let it revise. Repeat until the reviewer passes the plan, at most three rounds; after that, rule on the open findings yourself and log the rulings.

Read the final plan. If it lists open questions, this is stop point 1. Otherwise post a short summary of the plan to the owner and continue without waiting.

### 2. Implement

For each task in the plan, in order and never in parallel, dispatch a fresh implementer with [implementer.md](implementer.md). It receives only its task, the plan's design section, the decisions made so far, and its report path. It commits its own work.

- `DONE`: log it, next task.
- `CONCERNS`: read the concern. Rule on it, log the ruling, continue.
- `BLOCKED`: give it what it lacks and re-dispatch once. Still blocked: stop point 2.

### 3. Verify

Dispatch a verifier that runs the project checks from the root `package.json` (`lint`, `typecheck`, `knip`, and the tests where they exist). For a UI change it also opens the web preview (`npm run web:preview`, see AGENTS.md) and screenshots the changed screen into `reports/`. It fixes small breakage it caused and reports anything else. Unresolved breakage goes back to phase 2 as a new task.

### 4. Review

Two reviews, quality first, then correctness. Both must run on the final code; a hand-written imitation of either does not count.

- **Claude Code:** invoke the bundled `/simplify`, then `/code-review`, through the Skill tool, both as report-only (no `--fix`, and tell `/simplify` to stop before applying). They already run in their own context, so call them from the coordinator. Log each run in `progress.md` with the commit it reviewed.
- **Other agents:** use the agent's built-in review if it has one, otherwise dispatch a fresh reviewer per pass with this brief: *quality* checks the plan's design principles: duplication, units doing two jobs, hidden coupling, speculative abstraction, dead code, and code that should reuse an existing component or helper; *correctness* looks for bugs, unhandled edge cases, swallowed errors, and anything that can lose or corrupt data.

Reviewers report, they do not edit. Write the findings to `reports/review-<n>.md` and hand the path to a fresh implementer with [implementer.md](implementer.md), the findings as its task. It applies them, reruns the checks, commits, and may push back on a finding with a reason; you rule and log. Then rerun the review that had findings. A skipped finding is logged with its one-line reason and later listed in the PR. Three fix rounds without a clean review is stop point 3.

### 5. Finish

1. Feedback the owner gave during this task that applies beyond it: add rules to AGENTS.md with the `add-rule` skill, and deferred work or new ideas to `todo.md`. Remove `todo.md` entries this task completed.
2. Push the branch and open the PR. The description holds: what changed and why, every `Decision` from the ledger, skipped review findings with their reasons, and how to verify.
3. Report to the owner: the PR link, the decisions, and anything they still need to do.

## Coordinator rules

- Never edit source. Re-dispatch the implementer instead.
- Trust artifacts, not narration. After each dispatch, check that the plan, report or commits exist before you move on. A dispatch that did not happen leaves no trace in the transcript.
- Never skip or shorten a review, and never tell a reviewer what to ignore.
- Pass each subagent only what it needs, never the full history. Repeat the rules that matter in the brief; a rule buried in a long file gets missed.
- Every decision and every skipped finding is a ledger line. Nothing is dropped silently.
- Between tool calls, narrate at most one line. The ledger is the record.
