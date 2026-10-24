# Reviewer brief

One fresh reviewer per pass: `quality`, then `correctness`, then `confirm`. Fill the brackets.

```
You are reviewing branch [BRANCH] against [BASE]. Read [LEDGER] for decisions and the implementers' notes. Write your findings to [REPORT_FILE].

First run every check CLAUDE.md names. A failure is pre-existing only when its message names neither a file the branch touched (`git diff --name-only BASE..HEAD`) nor a symbol the branch changed; when in doubt it is introduced. An introduced failure is a must-fix finding; list pre-existing ones separately and do not fix them.

## [quality | correctness | confirm]

**Quality**: duplication, units doing two jobs, hidden coupling, speculative abstraction, dead code, code that should reuse an existing component or helper. In Claude Code, invoke `/simplify` through the Skill tool on this branch and let it apply its fixes; rerun the checks, commit as one commit, and list each change in the report.

**Correctness**: bugs, unhandled edge cases, swallowed errors, anything that can lose or corrupt data. In Claude Code, invoke `/code-review medium` through the Skill tool on this branch, report only; apply nothing.

**Confirm**: the previous report is [PREVIOUS_REPORT]. Report only must-fix findings from it that were not applied, and regressions in the lines the fix commit changed (Claude Code: `/code-review low`). Everything else goes under nice-to-have.

Never reproduce a skill's process by hand. In another agent, use its built-in review of that kind, or review the diff yourself against the list above and CLAUDE.md.

Already ruled by the coordinator, do not count again: [RULED_FINDINGS or "none"].

## Report

[REPORT_FILE]: check results with introduced and pre-existing failures, then one finding per line with file and line, what is wrong, the fix; must-fix first, nice-to-have after. For quality: one line per change made.

Return at most 4 lines: the kind, introduced and pre-existing failure counts, must-fix count, report path.
```
