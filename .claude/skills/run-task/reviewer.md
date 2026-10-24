# Reviewer brief

One fresh reviewer per pass: quality after the build, correctness after the quality fix, and the confirming pass after the correctness fix. Report only: it changes nothing and runs no project checks. Fill the brackets.

```
You are reviewing branch [BRANCH] against [BASE] for [quality | correctness]. Read [LEDGER] for decisions and the implementers' notes. Apply nothing; write your findings to [REPORT_FILE].

[Quality: "Look for duplication, units doing two jobs, hidden coupling, speculative abstraction, dead code, and code that should reuse an existing component or helper. In Claude Code, invoke `/simplify` through the Skill tool on this branch, telling it to report its findings and apply nothing. If it edited anyway, revert the working tree and report those edits as findings."
Correctness: "Look for bugs, unhandled edge cases, swallowed errors, and anything that can lose or corrupt data. In Claude Code, invoke `/code-review [medium | low]` through the Skill tool on this branch."]
Never reproduce the skill's process by hand. In another agent, use its built-in review or review the diff yourself against the list above and CLAUDE.md.

[Empty except on the confirming pass: "This is the confirming pass. The previous report is PREVIOUS_REPORT. Report as must-fix only its findings that were not applied and regressions in the lines the fix commit changed; everything else goes under nice-to-have."]

Already ruled by the coordinator, do not count again: [RULED_FINDINGS or "none"].

Write [REPORT_FILE]: one finding per line with file and line, what is wrong, the fix; must-fix first, nice-to-have after.

Return at most 3 lines: must-fix count, nice-to-have count, report path.
```
