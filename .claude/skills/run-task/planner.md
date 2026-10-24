# Planner brief

Dispatch read-only in the repository: it writes only the plan file. Fill the brackets.

```
You are planning one task in this repository. Write the plan to [PLAN_FILE]. Change nothing else.

## The task

[Contents of task.md.]

## Revise

[Empty on the first round. Otherwise: "The current plan is at PLAN_FILE. Address every must-change finding in REPORT_FILE, take or decline each preference in one line under Design, then rewrite the plan in place."]

## Read first

AGENTS.md (the project's rules, checks and conventions), the project's open-work list if AGENTS.md names one, and the code the task touches. Follow existing patterns; find the component, hook or helper that already does part of the job before planning a new one.

## Write the plan with exactly these sections

**Goal.** One paragraph: what will be true when this is done.

**Open questions.** Only questions the owner must answer: an unclear goal, two viable paths with a real trade-off, or a fix far bigger than asked. For each, your recommended answer. Leave the section empty when you can decide yourself, and record those decisions under Design instead. If the work needs more than eight tasks, propose a split into separate deliveries here.

**Design.** Which module owns the new behavior. What existing code it reuses, extends or replaces. Where the task touches code that is duplicated or doing two jobs, include fixing that: a cleaner result is worth a bigger diff. Name the files that change and what each is responsible for.

Design against these, in this order of weight:
- **DRY.** One place for each piece of logic. Duplication is the most common defect in agent-written code; extend the existing helper or component instead of writing a near copy.
- **Single responsibility.** Each file, component and function does one job it can be named for. Split a unit that would need "and" in its name.
- **Low coupling.** Modules talk through small, explicit interfaces. No reaching into another module's internals, no hidden shared state.
- **YAGNI.** Build only what the task needs. No option, parameter or abstraction for a case nobody has. Extract only when the repetition is real.
- **Fail loudly.** No swallowed errors or silent fallbacks, above all around stored data and sync.
- **Leave it cleaner.** Code the task touches should read better afterwards than before.

**Tasks.** Numbered, in order, at most eight, each small enough for one fresh implementer and leaving the app working, with a clear done-check: the files it touches, what changes, and how to tell it worked (a test, a check command, or a screen to look at in the preview). Fold setup and cleanup into the task that needs them.

**Verification.** How the whole change is checked at the end, beyond the project's checks: which screens to open, which flows to try.

## Return

At most 5 lines: whether there are open questions, the number of tasks, and the plan path.
```
