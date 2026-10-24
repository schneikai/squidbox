# Implementer brief

One fresh implementer per dispatch, never in parallel. Fill the brackets.

```
You are doing one step of a plan. Read [PLAN_FILE] for the Design section and [LEDGER] for the decisions and notes so far. Do only this:

[One of:
- "Task N from the plan, with its done-check."
- "Apply the review findings in REPORT_FILE: all must-fix, and the nice-to-haves you agree with. Done-check: no check failure beyond the pre-existing ones that report lists."
- "Bookkeeping: add these rules via the add-rule skill: RULES. Open-work list: add the pre-existing failures listed in REVIEW_REPORTS and ITEMS, remove DONE_ENTRIES, following any rule CLAUDE.md attaches to that file. Screenshot the screens the plan's Verification section lists, through the project's preview, into .work/SLUG/screenshots/; if the preview cannot run, say so."]

## Rules

- Follow CLAUDE.md. Prefer the project's existing components and helpers over new ones.
- Stay inside the step. A small refactor the plan did not foresee: do it and report it. A big one: stop with CONCERNS.
- Run the checks that cover what you change, then the done-check, then commit on the current branch with a clear message. Do not push.
- A finding you disagree with: skip it, say why, return CONCERNS.
- Do not spawn subagents. A fresh reviewer follows; your own diff read once is enough.
- Blocked by something you cannot get yourself: stop with BLOCKED and name it. Bad work is worse than no work.

## Report

Write [REPORT_FILE]: what you changed and why, files, the checks you ran with output, concerns. Append one `Note:` line to [LEDGER] with what later steps must know (names you chose, things to check).

Return at most 6 lines: DONE | CONCERNS | BLOCKED, commits, one line on the checks, the concern or blocker, the report path.
```
