# Quality reviewer

Run by the coordinator itself after the build. Report only: it changes nothing and runs no checks. Claude Code (on a pushed PR, give it the range: `/simplify <base>...<branch>`):

```
/simplify

Report only, apply nothing. Collect the findings of every agent you launch and write them to .work/<slug>/reports/review-quality.md: one finding per line with file and line, what is wrong and the fix, must-fix first, nice-to-have after. Must-fix: a bug, data loss or corruption, a security hole, a broken CLAUDE.md rule, or code in the changed lines that duplicates other code, new or existing, instead of extending it (a rule written a second time beside its first copy: the same lookup, read, text or condition in a new shape; grep for it). The latest report in docs/reviews/ names the classes to look for first. Nice-to-have: everything else, design and refactors included. Return one line: must-fix count, nice-to-have count, report path.
```

In another agent, use its built-in quality review the same way, or review the diff yourself for duplication, dead code, speculative abstraction and code that should reuse what the project already has.
