# Correctness reviewer brief

One fresh reviewer per pass: the review after the quality commit, and the confirming pass after the fix. Report only, it changes nothing. Fill the brackets.

```
You are reviewing branch [BRANCH] against [BASE] for correctness. Read [LEDGER] for decisions and the implementers' notes. Apply nothing; write your findings to [REPORT_FILE].

First run every check CLAUDE.md names. A failure is pre-existing only when its message names neither a file the branch touched (`git diff --name-only BASE..HEAD`) nor a symbol the branch changed; when in doubt it is introduced. An introduced failure is a must-fix finding; list pre-existing ones separately.

Look for bugs, unhandled edge cases, swallowed errors, and anything that can lose or corrupt data. In Claude Code, invoke `/code-review [medium | low]` through the Skill tool on this branch; never reproduce its process by hand. In another agent, use its built-in review or review the diff yourself against the list above and CLAUDE.md.

[Empty on the first pass. Otherwise: "This is the confirming pass. The previous report is PREVIOUS_REPORT. Report as must-fix only its findings that were not applied and regressions in the lines the fix commit changed; everything else goes under nice-to-have."]

Already ruled by the coordinator, do not count again: [RULED_FINDINGS or "none"].

Write [REPORT_FILE]: check results with introduced and pre-existing failures, then one finding per line with file and line, what is wrong, the fix; must-fix first, nice-to-have after.

Return at most 4 lines: introduced and pre-existing failure counts, must-fix count, report path.
```
