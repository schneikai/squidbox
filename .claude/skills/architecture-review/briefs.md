# Briefs

One prompt per subagent. Fill the brackets. Every reviewer is read-only and report-only, gets a fresh context, and is told nothing beyond its brief, the scope and (except the task agents) the map. Every reviewer brief ends with the common tail at the bottom of this file; paste it in.

## Map

```
Write a one-page map of [SCOPE] in the repo at [ROOT] to [MAP_FILE]. Change nothing else.

Read CLAUDE.md ("Code layout", "Where data is saved") and docs/sync-design.md §8 first. Then, for every top-level folder in the scope (and every feature folder under features/): one sentence on what it owns, taken from its exports and names, not guessed. List who depends on whom between folders, using these counts: [IMPORT_MATRIX]. List where each kind of thing lives today, with counts: React contexts and providers, hooks (use*.ts*), helpers (lib/, utils/ and anything else shared), actions/ folders, web and native variant pairs (*.web.ts*, *.ios.ts*). Note every folder the tree has that CLAUDE.md does not name, and every CLAUDE.md layout rule the tree no longer follows. End with the baseline: [CATCH_COUNTS], [LARGE_FILES].

No judgements, no findings: what is, in one page. Return the file path and one line on what surprised you.
```

## Homes and boundaries

```
You review [SCOPE] in the repo at [ROOT] for one thing: does each kind of thing have one obvious home, and are the boundaries between folders the ones the code's changes need? Read CLAUDE.md "Code layout", the map at [MAP_FILE], and then the code. Write your findings to [REPORT_FILE]; change nothing else.

First, trace these likely changes through the tree and, for each, list every folder a correct implementation touches:
1. Add a field to a synced collection and show it on its detail screen.
2. Add a new item kind with a list, a detail screen and an edit sheet.
3. Add a setting that syncs with the account.
4. Change how one web variant renders.
5. Add an action to a detail screen's menu.
6. Add a route that also opens inside a sheet.
[OWNER_SCENARIOS]
A folder touched by unrelated changes, or a change that crosses more than three folders, is a finding: say which change, which folders, and what one home would look like.

Then flag:
- A kind of thing with two homes. Today: contexts in four *-context features and inside four owning features; hooks both in features/ and hooks/; helpers in both lib/ and utils/ while CLAUDE.md names only lib/; actions/ folders in some detail features and not others. For each, name the one home and what moves.
- A feature importing another feature's internals (a file that is not its screen, hook or context). Count the pairs; propose the rule CLAUDE.md should have (what a feature may import from another) and the eslint restriction that would enforce it, with today's hit count.
- A folder in the tree CLAUDE.md does not name, or a CLAUDE.md layout rule the code no longer follows: propose the rule change or the code change, not both.
- A route file in app/ that holds logic, a file with two exported components, a hand-written type the schema, a repository or @squidbox/shared already gives.
You may propose moving the furniture. Say what moves, where, and what gets simpler.
```

## Duplication and depth

```
You review [SCOPE] in the repo at [ROOT] for duplication and shallow modules. Read the map at [MAP_FILE], then the code. Write your findings to [REPORT_FILE]; change nothing else.

Flag:
- Near-copies of a helper or component across modules; name the one to keep and the callers to move.
- lib/ or utils/ entries with one caller: they belong next to that caller.
- Pass-through wrappers and shallow modules: an interface as wide as its body. Apply the deletion test: would deleting it and inlining its callers be smaller and clearer? If yes, it is a finding.
- Data clumps (the same three fields travelling together), repeated switches on the same type, speculative abstractions no caller needs, stringly-typed values where a type or constant exists, comments that narrate instead of explaining a non-obvious why.
- Web and native pairs (x.ts and x.web.ts) are not duplicates. Flag a pair whose two sides differ in interface or behaviour, and a platform branch inside a file where a variant pair is the project's pattern.
For every flag, name the existing code to extend instead of writing new.
```

## Data integrity

```
You review [SCOPE] in the repo at [ROOT] for data integrity. Read CLAUDE.md "Where data is saved", docs/sync-design.md §2a, §4, §8 and §12, the map at [MAP_FILE], then the code. Write your findings to [REPORT_FILE]; change nothing else.

Flag:
- Data in the wrong tier: a device setting the user would miss on another device, synced data that is a cache, a local-only field that can reach sync.
- Errors swallowed or silently defaulted around stored data: a catch that returns a fallback, a missing await, a write whose failure nobody sees. Start from the catch sites in the map.
- Writes to more than one table or file outside one transaction; a record saved before its file, or the reverse, where a crash in between loses either.
- Any place the multi-tenant invariant (§2a) depends on a caller remembering a filter.
- The sync worker, the repositories and library/merge code where they diverge from §8, and §12 choices the code no longer honours.
A finding names what is lost or corrupted, and when.
```

## Discoverability by task

Two or three agents, each handed one task and no map. Pick tasks the owner is likely to ask for; defaults below. They do not change anything.

```
You are a coding agent landing cold in the repo at [ROOT]. Your task: [TASK]. Do not make the change. Instead, find everything you would need to touch, and keep a log as you go: every file you open and why, every wrong turn (a place you expected to find it and did not), every name you had to guess, and what one sentence in CLAUDE.md would have saved you. Read CLAUDE.md first, as any agent would. Stop when you are sure of the full list of files, or after 25 file reads. Write the log and the final list to [REPORT_FILE]; change nothing else. Return the number of files opened, the number of wrong turns, and one line on the worst stall.
```

Default tasks: "find where a contact is deleted and everything else that must change when that behaviour changes"; "add a new setting that syncs with the account and shows in Settings"; "find the component used for a grey text link beside a section title and where it is used".

## UX parity

Only when the scope has screens.

```
You review [SCOPE] in the repo at [ROOT] for consistency across features in UI and UX. Read CLAUDE.md "UI / Components", the squidbox-ui skill (its conflicts table and "Checks before calling a screen done"), the map at [MAP_FILE], then the code. Write your findings to [REPORT_FILE]; change nothing else.

Build two inventories first and put them in the report: every button, menu and alert label in scope, grouped by verb; and, for each item kind (asset, album, post, contact, list, prompt, rule), how it is created, edited, deleted, restored and confirmed, and with which components.

Then flag:
- The same job done differently across item kinds: two verbs for one act (Delete and Remove), two capitalisations, a question mark on one confirm and not another, an edit screen for one kind and in-place editing for another, without a reason in the rules.
- A sheet where the rules say push, or the reverse; a Save button or discard prompt on a screen pushed outside a sheet; a sheet that opens a second sheet.
- A raw primitive or restyled look-alike where a project component exists; a style spread in a screen; a duration or spring not from the motion tokens; a label that names a feature by a second name.
- A screen missing one of the four states, or an icon-only button without a label.
You may open the web preview read-only (README "Web preview") when source alone cannot tell.
```

## TL;DR check

```
Your job is to break this TL;DR before the owner reads it. Read [TLDR_FILE], the findings in [REPORTS_DIR], CLAUDE.md, docs/sync-design.md §12, and the code each claim rests on. For every claim: does it follow from a finding and the code, or is it asserted? Is the maintainability gain concrete (fewer places to change, one home instead of two, a lint instead of a rule) or a slogan? Would the changes together leave fewer places to change, or just different ones? Does it contradict CLAUDE.md or a recorded decision? Write [REPORT_FILE]: one line per claim, "holds" or "does not hold: why", blunt, no praise. Return the counts.
```

## Common tail for every reviewer

```
Rules: the repo's own rules (CLAUDE.md, the design docs) win over any general principle; when they conflict, say so and propose which should change. Skip anything the lint, the typecheck or knip already enforces. At most 10 findings, ranked by cost. Each finding, one line per field: location (file:line, or a count with the command that produced it); the rule or principle; the evidence (what the code does, quoted or counted); the cost (what gets harder or breaks because of this, in one sentence; no cost, no finding); the fix as a target shape in one line; the files a fix would touch; size S (under an hour), M (half a day), L (a day or more); for whom (owner, agent, both); the test that covers the behaviour, or "none". Then a short "Checked and sound" list: what you looked at and found fine, so nobody looks again. Write it to the report file and return one line: finding count, report path.
[ADDITIONAL_FOCUS]
```
