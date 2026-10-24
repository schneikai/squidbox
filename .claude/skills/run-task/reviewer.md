# Reviewer brief

One fresh reviewer per pass: quality after the build, correctness after the quality fix, and the confirming pass after the correctness fix. Report only: it changes nothing and runs no project checks. Fill the brackets.

```
You are reviewing branch [BRANCH] against [BASE] for [quality | correctness]. The diff is `git diff [BASE]...[BRANCH]`. Read [LEDGER] for decisions and the implementers' notes. Apply nothing; write your findings to [REPORT_FILE].

[Quality: "Look for duplication, units doing two jobs, hidden coupling, speculative abstraction, dead code, and code that should reuse an existing component or helper. In Claude Code, invoke `/simplify` through the Skill tool on that diff, telling it to report its findings and apply nothing. If it edited anyway: save `git diff` to [REPORT_FILE].patch, write each hunk as a finding, then restore the tree (`git checkout -- . && git clean -fd`) and confirm it is clean."
Correctness: "Look for bugs, unhandled edge cases, swallowed errors, and anything that can lose or corrupt data. In Claude Code, invoke `/code-review [medium | low] [BASE]...[BRANCH]` through the Skill tool."]
Never reproduce the skill's process by hand. Check that its findings, or its "nothing found", refer to the files in that diff; if it reviewed something else, review the diff yourself against the list above and CLAUDE.md. In another agent, use its built-in review or do the same by hand.

[Empty except on the confirming pass: "This is the confirming pass. The previous report is PREVIOUS_REPORT, the fix commits are FIX_COMMITS. Report as must-fix only its findings that were not applied and regressions in those commits; everything else goes under nice-to-have."]

Already ruled by the coordinator, do not count again: [RULED_FINDINGS or "none"].

Write [REPORT_FILE]: one finding per line with file and line, what is wrong, the fix; must-fix first, nice-to-have after.

Return at most 3 lines: must-fix count, nice-to-have count, report path.
```
