# Correctness reviewer

Run by the coordinator itself after the quality fix, once. Report only: it changes nothing and runs no checks. Claude Code:

```
/code-review <base>...<branch>

Report only, apply nothing. Write the findings to .work/<slug>/reports/review-correctness.md: one finding per line with file and line, what is wrong and the fix, must-fix first, nice-to-have after. Return one line: must-fix count, nice-to-have count, report path.
```

In another agent, use its built-in code review the same way, or review the diff yourself for bugs, unhandled edge cases, swallowed errors and anything that can lose or corrupt data.
