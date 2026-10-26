# Quality reviewer

Run by the coordinator itself after the build. Report only: it changes nothing and runs no checks. Claude Code (on a pushed PR, give it the range: `/simplify <base>...<branch>`):

```
/simplify

Report only, apply nothing. Collect the findings of every agent you launch and write them to .work/<slug>/reports/review-quality.md: one finding per line with file and line, what is wrong and the fix, must-fix first, nice-to-have after. Must-fix: a bug, data loss or corruption, a security hole, a broken CLAUDE.md rule, or code in the changed lines that duplicates other code, new or existing, instead of extending it. Nice-to-have: everything else, design and refactors included. Return one line: must-fix count, nice-to-have count, report path.
```

In another agent, use its built-in quality review the same way, or review the diff yourself for duplication, dead code, speculative abstraction and code that should reuse what the project already has.
