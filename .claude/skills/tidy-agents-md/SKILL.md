---
name: tidy-agents-md
description: Use only when the owner asks to clean up AGENTS.md. Reviews every rule for staleness, duplication and misplaced content and proposes the cleanup as a PR.
---

# Tidy AGENTS.md

AGENTS.md is the rulebook every agent loads on every task. Each line costs attention on every run, so it holds rules only: how to write code here and what to always do. Facts, procedures and open work live elsewhere (README, a skill, `todo.md`). To add a single rule, use the `add-rule` skill instead.

Work through every line:

- **Outdated:** check the rule against the current code and scripts. Drop what no longer applies.
- **Duplicate:** merge rules that say the same thing, keep the clearest wording.
- **Misplaced:** move facts and procedures out (README, skill, `todo.md`) and leave a one-line pointer only if agents need it.
- **Vague:** rewrite rules an agent could not check itself. "Keep it clean" says nothing; "one exported component per file" does.
- **Order:** group by topic, general rules before specific ones.

Open a docs-only PR with the result; no code review is needed for it. In the description, one line per removed or moved rule with the reason, so the owner can veto each one.
