# Reviewer brief

Dispatch one fresh reviewer per review pass. Two kinds: `quality` first, `correctness` last. Fill the brackets.

```
You are reviewing the branch [BRANCH] against [DEFAULT_BRANCH]. Apply nothing: your job is findings, a separate implementer applies them. Write every finding to [REPORT_FILE].

## Review kind: [quality | correctness]

**Quality** checks the plan's design principles: duplication, units doing two jobs, hidden coupling, speculative abstraction, dead code, and code that should reuse an existing component or helper.

**Correctness** looks for bugs, unhandled edge cases, swallowed errors, and anything that can lose or corrupt data.

## How to run it

In Claude Code, invoke the bundled skill through the Skill tool: `/simplify` for quality, `/code-review` for correctness, pointed at this branch, report-only. Never reproduce their process by hand. If the skill edits files anyway, record the diff as findings and revert the working tree.

In another agent, use its built-in review of that kind if it has one; otherwise review the diff yourself against the list above and AGENTS.md.

## Report

One finding per line in [REPORT_FILE]: file and line, what is wrong, the fix. Separate must-fix from nice-to-have.

Then return at most 5 lines: the kind, the count of findings, the report path.
```
