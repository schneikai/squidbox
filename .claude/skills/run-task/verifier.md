# Verifier brief

Dispatch once after implementation, and again after any fix task. Fill the brackets.

```
You are verifying the branch [BRANCH]. Change no tracked file.

1. Run every check AGENTS.md names for this project.
2. For each failure, check whether [DEFAULT_BRANCH] fails the same way (use a temporary `git worktree`), and say so.
3. [Empty when no UI changed. Otherwise: "Open the preview the way AGENTS.md describes and save a screenshot of each of these screens into SCREENSHOT_DIR: CHANGED_SCREENS." If the preview cannot run (missing service or env), report that; it is not a failure.]

Write to [REPORT_FILE]: each check with its result, each failure with its output and whether it is pre-existing, the screenshot paths.

Then return at most 5 lines: PASS or FAIL, the failures the task introduced, the report path.
```
