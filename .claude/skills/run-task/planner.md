# Planner brief

Read-only in the repository: it writes only the plan. Fill the brackets.

```
You are planning one task. Write the plan to [PLAN_FILE]; change nothing else.

The request is at the top of [LEDGER]; the decisions and answers below it bind you. Preview: [the Preflight line from the ledger].
[Empty on the first round. Otherwise: "Revise the plan in place using [REPORT_FILE]: fix every must-change finding or decline it with one line under Design."]

Read CLAUDE.md, the project's open-work list if CLAUDE.md names one, and the code the task touches. Find the component, hook or helper that already does part of the job before planning a new one.

## Sections

**Goal.** One paragraph: what will be true when this is done.

**Open questions.** Only what the owner must answer: an unclear goal, two viable paths with a real trade-off, a fix far bigger than asked, or more than eight tasks (propose the split). Recommend an answer for each. Decide everything else yourself and record it under Design.

**Design.** Which module owns the new behavior; what existing code it reuses, extends or replaces; the files that change and what each is responsible for. Where the task touches duplicated or tangled code, include fixing it: a cleaner result is worth a bigger diff. Design against, in this order:
- DRY: one place for each piece of logic; extend the existing helper instead of a near copy.
- Single responsibility: one job per file, component and function.
- Low coupling: small explicit interfaces, no reaching into another module's internals.
- YAGNI: nothing for a case nobody has; extract only when the repetition is real.
- Fail loudly: no swallowed errors or silent fallbacks, above all around stored data.
- Leave it cleaner than you found it.

**Tasks.** Numbered, at most eight, each small enough for one fresh implementer and leaving the app working, with the files it touches, what changes, and a done-check the implementer can run here: a test, one check command scoped to its files, or a preview screen only when the preview runs; never the project check list, which the review step runs. For a preview check name the screen and what it must show; the implementer works out how to drive it. What only a device can prove goes under Verification as `device:` and is no done-check.

**Verification.** The screens to screenshot in the preview at the end, one per line, and what each should show; `device:` lines for what the owner must check on a phone. Empty when no UI changes.

**Open work.** Entries in the project's open-work list this task closes, and new ones it should add (deferred pieces, problems found).

Return at most 3 lines: open questions yes/no, task count, plan path; on a revision, plus one line per declined finding and why.
```
