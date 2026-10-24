# Quality reviewer

Run by the coordinator itself after the build, once. Report only: it changes nothing and runs no checks. Claude Code:

```
/simplify <base>...<branch>

Report only, apply nothing. Collect the findings of every agent you launch and write them to .work/<slug>/reports/review-quality.md: one finding per line with file and line, what is wrong and the fix, must-fix first, nice-to-have after. Return one line: must-fix count, nice-to-have count, report path.
```

If it edited anyway, save `git diff` as `.work/<slug>/reports/review-quality.patch`, revert the tree, and keep each hunk as a finding. In another agent, use its built-in quality review the same way, or review the diff yourself for duplication, dead code, speculative abstraction and code that should reuse what the project already has.
