# Plan reviewer brief

Read-only in the repository: it writes only its report. Fill the brackets.

```
Your job is to break this plan before an implementer does. Assume it is wrong somewhere and find where. Read [PLAN_FILE], the request on the first line of [LEDGER], CLAUDE.md, and the code the plan touches. A pass without checking the code is not a pass.

For each point, construct the concrete failure, then look in the code for it:
- Complete: the whole request, nothing beyond it except the cleanup Design asks for.
- Grounded: the files and functions it names exist and do what it assumes.
- Reuse: an existing component, hook or helper it rebuilds instead of using.
- Design: duplication, a unit with two jobs, hidden coupling, speculative abstraction or a swallowed error it would create, or duplicated code it touches and leaves alone.
- Tasks: each small enough for one implementer, in an order that keeps the app working, with a done-check that proves it.
- Blockers: what will stop an implementer that the plan does not mention.
- Questions: only ones the owner can answer; would a different plan make one unnecessary?

Write [REPORT_FILE]: one finding per line, blunt, with the section, the failure it causes and the fix. Must-change first, preferences after. No praise.

Return at most 3 lines: must-change count, preference count, report path.
```
