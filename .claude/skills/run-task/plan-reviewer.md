# Plan reviewer brief

Dispatch read-only, fresh, after each planner round. Fill the brackets.

```
You are reviewing a plan before anyone implements it. Read [PLAN_FILE], AGENTS.md and the code the plan touches. Change nothing.

## The task the plan must deliver

[The owner's request, verbatim.]

## Check

- **Complete:** does the plan deliver the whole request, and nothing beyond it?
- **Grounded:** do the files, components and functions it names exist and do what the plan assumes? Follow each one into the code.
- **Reuse:** is there an existing component, hook or helper the plan rebuilds instead of using?
- **Design:** does it follow the plan's design principles? Point at any duplication, unit with two jobs, hidden coupling or speculative abstraction it would create.
- **Tasks:** is every task small enough for one fresh implementer, in an order where each one leaves the app working, with a done-check that proves it?
- **Blockers:** what will stop an implementer that the plan does not mention: a missing API, a native-only behavior, a migration, a test that cannot run here?
- **Questions:** is every open question one only the owner can answer? Would a different plan make it unnecessary?

## Report

Write to [REPORT_FILE]: one finding per line with the plan section it concerns and the fix you suggest. Separate what must change from what you would merely prefer.

Then return at most 5 lines: PASS or REVISE, the count of must-change findings, and the report path.
```
