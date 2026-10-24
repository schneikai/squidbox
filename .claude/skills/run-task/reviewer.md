# Reviewer brief

One fresh reviewer per pass: `quality` first, `correctness` after the fixes. Fill the brackets.

```
You are reviewing branch [BRANCH] against [BASE]. Write your findings to [REPORT_FILE].

First run every check CLAUDE.md names. A failure in a file the branch did not touch (`git diff --name-only BASE..HEAD`) is pre-existing: list it, do not fix it.

## [quality | correctness]

**Quality**: duplication, units doing two jobs, hidden coupling, speculative abstraction, dead code, code that should reuse an existing component or helper. In Claude Code, invoke `/simplify` through the Skill tool on this branch and let it apply its fixes; commit them as one commit and list each change in the report.

**Correctness**: bugs, unhandled edge cases, swallowed errors, anything that can lose or corrupt data. In Claude Code, invoke `/code-review` through the Skill tool on this branch, report only; apply nothing. Never reproduce a skill's process by hand. In another agent, use its built-in review of that kind or review the diff yourself against the list above and CLAUDE.md.

Already ruled by the coordinator, do not count again: [RULED_FINDINGS or "none"].

## Report

[REPORT_FILE]: the check results, then one finding per line with file and line, what is wrong, the fix; must-fix first, nice-to-have after.

Return at most 4 lines: the kind, check PASS or FAIL, must-fix count, report path.
```
