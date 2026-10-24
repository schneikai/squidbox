---
name: tidy-agents-md
description: Use when adding a rule to AGENTS.md, or when the owner asks to clean it up. Keeps AGENTS.md short, current, rules-only and free of duplicates.
---

# Tidy AGENTS.md

AGENTS.md is the rulebook every agent loads on every task. Each line costs attention on every run, so it holds rules only: how to write code here and what to always do. Facts, procedures and open work live elsewhere (README, a skill, `todo.md`).

## Add a rule

Before adding anything:

1. Search AGENTS.md for an existing rule on the topic. Extend it instead of adding a second one.
2. Skip the rule if a lint, a type or a test already enforces it.
3. Write it as a rule, not a story: what to do or avoid, and in a few words why when the reason is not obvious.
4. One rule per line, under the existing section it belongs to. Add a section only when none fits.
5. If it is a fact or a procedure rather than a rule, put it in the README or the matching skill and, if needed, point to it from AGENTS.md in one line.

If you noticed stale or duplicate rules while adding yours, say so to the owner in one line and offer the full pass. Do not run it unasked.

## Full pass

Only when the owner asks. Work through every line:

- **Outdated:** check the rule against the current code and scripts. Drop what no longer applies.
- **Duplicate:** merge rules that say the same thing, keep the clearest wording.
- **Misplaced:** move facts and procedures out (README, skill, `todo.md`) and leave a one-line pointer only if agents need it.
- **Vague:** rewrite rules an agent could not check itself. "Keep it clean" says nothing; "one exported component per file" does.
- **Order:** group by topic, general rules before specific ones.

Open a PR with the result. In the description, one line per removed or moved rule with the reason, so the owner can veto each one.
