---
name: add-rule
description: Use whenever a rule is about to be added to CLAUDE.md, for example when the owner gives feedback that applies beyond the current task. Keeps the file short and free of duplicates.
---

# Add a rule to CLAUDE.md

CLAUDE.md holds rules only; see the `tidy-claude-md` skill for what belongs there and what does not.

1. Search CLAUDE.md for an existing rule on the topic. Extend it instead of adding a second one.
2. Skip the rule if a lint, a type or a test already enforces it.
3. Write it as a rule, not a story: what to do or avoid, and in a few words why when the reason is not obvious.
4. One rule per line, under the existing section it belongs to. Add a section only when none fits.
5. If it is a fact or a procedure rather than a rule, put it in the README or the matching skill, and point to it from CLAUDE.md in one line only if agents need it.
6. CLAUDE.md is for every developer on the project. A personal preference does not belong there.

Leave existing rules alone here. If you noticed stale, duplicate or misplaced ones while adding yours, mention them in your final report and point to `tidy-claude-md`.
