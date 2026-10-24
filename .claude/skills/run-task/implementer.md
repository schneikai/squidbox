# Implementer brief

One fresh implementer per dispatch. Fill the brackets.

```
You are doing one step of a plan. Read [PLAN_FILE] for the Design section and [LEDGER] for the decisions and notes so far. [Empty, or: "First commit or discard the uncommitted changes left by the previous step."] Do only this:

[One of:
- "Build the plan: commit as you go with clear messages, run the plan's done-check, then append `Build DONE <first>..<last>` to LEDGER."
- "Apply the review findings in REPORT_FILE: [all must-fix, and the nice-to-haves you agree with | the ones you agree with]. If REPORT_FILE.patch exists, start from `git apply` of it and drop the hunks you disagree with. Then run every check CLAUDE.md names. A failure is pre-existing only when its message names neither a file the branch touched (`git diff --name-only BASE..HEAD`) nor a symbol the branch changed; when in doubt it is introduced. A check that does not run at all (missing tool, dependency or service) is neither: install what CLAUDE.md names and rerun, else return BLOCKED naming the check. Fix introduced failures and list pre-existing ones in your report. Done-check: every check ran and no introduced failure is left."
- "Bookkeeping: add these rules via the add-rule skill: RULES. Open-work list: add ITEMS and the pre-existing failures listed in FIX_REPORTS, remove DONE_ENTRIES, and do whatever rule CLAUDE.md attaches to that file; if that needs a tool you lack, return CONCERNS naming the step. Screenshot the screens the plan's Verification section lists, through the project's preview as CLAUDE.md describes it (start what it needs, stop it after), into .work/SLUG/screenshots/."]

## Rules

- Follow CLAUDE.md. Prefer the project's existing components and helpers over new ones.
- Stay inside the step. A small refactor the plan did not foresee: do it and report it. A big one: stop with CONCERNS.
- Run only the done-check, not the project check list, then commit on the current branch with a clear message. Do not push.
- A finding you disagree with: skip it, say why, return CONCERNS.
- Do not spawn subagents. A review follows; your own diff read once is enough.
- Blocked by something you cannot get yourself: stop with BLOCKED and name it. Bad work is worse than no work.

## Report

Write [REPORT_FILE]: what you changed and why, files, the done-check with output, concerns. Append one `Note:` line to [LEDGER] with what later steps must know (names you chose, things to check).

Return a short status, no narrative: DONE | CONCERNS | BLOCKED, commits, one line on the done-checks, the report path, then one line per skipped finding (file:line, the finding, why) and one per pre-existing failure.
```
