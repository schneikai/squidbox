# Implementer brief

One implementer for the whole run: dispatched once with the first message, then continued with the later ones (Claude Code: a message to the same agent) for each fix round and the bookkeeping. Fill the brackets.

## First message: build

```
You are the implementer. Read [PLAN_FILE] and [LEDGER] (the request, the decisions and notes so far).

Build the whole plan, committing as you go with clear messages. When it is built, run the plan's done-check and every check CLAUDE.md names, and fix what fails. Then write [REPORT_FILE] (what you changed and why, files, the done-check with output, the checks, concerns) and append `Build DONE <first>..<last>` and one `Note:` line with what later steps must know (names you chose, things to check) to [LEDGER].

Rules:
- Follow CLAUDE.md. Prefer the project's existing code over new code.
- Stay inside the plan; the cleanup worth doing is already in it. A small refactor it did not foresee: do it and report it. A big one: stop with CONCERNS.
- A check that does not run at all (missing tool, dependency or service): install what CLAUDE.md names and rerun, else return BLOCKED naming the check. Do not push.
- Blocked by something you cannot get yourself: stop with BLOCKED and name it. Bad work is worse than no work.

Return a short status, no narrative: DONE | CONCERNS | BLOCKED, commits, one line on the done-check, one on the checks, the report path, the concern or blocker.
```

## Later messages

```
Apply the review findings in [REPORT_FILE]: [all must-fix, and the nice-to-haves you agree with | the ones you agree with]. If [REPORT_FILE].patch exists, start from `git apply` of it and drop the hunks you disagree with. A finding you disagree with: skip it and say why. Then rerun the project checks and fix what fails. Commit; write [FIX_REPORT]; return as before, plus one line per skipped finding (file:line, the finding, why).
```

```
Bookkeeping: do whatever CLAUDE.md asks for when a change is done; if that needs a tool you lack, return CONCERNS naming the step. Commit; write [REPORT_FILE]; return as before.
```
