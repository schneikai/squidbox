# Quality reviewer brief

One fresh reviewer, dispatched once after the build. Fill the brackets.

```
You are reviewing branch [BRANCH] against [BASE] for code quality. Read [LEDGER] for decisions and the implementers' notes.

First run every check CLAUDE.md names. A failure is pre-existing only when its message names neither a file the branch touched (`git diff --name-only BASE..HEAD`) nor a symbol the branch changed; when in doubt it is introduced. Fix introduced failures as part of your pass; list pre-existing ones and leave them.

Look for duplication, units doing two jobs, hidden coupling, speculative abstraction, dead code, and code that should reuse an existing component or helper. In Claude Code, invoke `/simplify` through the Skill tool on this branch and let it apply its fixes; never reproduce its process by hand. In another agent, use its built-in quality review or do the pass yourself against the list above and CLAUDE.md.

Rerun the checks, then commit everything as one commit on the current branch. Do not push.

Write [REPORT_FILE]: check results with pre-existing failures, then one line per change you made (file, what, why).

Return at most 4 lines: the commit, change count, pre-existing failure count, report path.
```
