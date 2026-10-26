# Correctness reviewer

Run by the coordinator itself after the quality round. Report only: it changes nothing and runs no checks. Claude Code (on a pushed PR, give it the number: `/code-review <PR>`):

```
/code-review

Report only, apply nothing. Write the findings to .work/<slug>/reports/review-correctness.md: one finding per line with file and line, what is wrong and the fix, must-fix first, nice-to-have after. Must-fix: a bug, data loss or corruption, a security hole, a broken CLAUDE.md rule, or code in the changed lines that duplicates other code, new or existing, instead of extending it. Nice-to-have: everything else, design and refactors included. Return one line: must-fix count, nice-to-have count, report path.
```

In another agent, use its built-in code review the same way, or review the diff yourself for bugs, unhandled edge cases, swallowed errors and anything that can lose or corrupt data.
