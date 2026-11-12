# Briefs

One prompt per subagent. Fill the brackets. Every scanner is read-only and report-only (Data integrity may run tests and write a throwaway one, and leaves the tree as it found it), gets a fresh context, is told nothing beyond its brief, the scope and (except the task agents) the map, and never reads another scanner's file. Every scanner brief except Map and the task agents ends with the common tail at the bottom of this file; paste it in. The consolidator gets its own brief and no tail.

## Map

```
Write a one-page map of [SCOPE] in the repo at [ROOT] to [MAP_FILE]. Change nothing else.

Read CLAUDE.md ("Code layout", "Where data is saved") and docs/sync-design.md §8 first. Then, for every top-level folder in the scope (and every feature folder under features/): one sentence on what it owns, taken from its exports and names, not guessed. List who depends on whom between folders, using these counts: [IMPORT_MATRIX]. List where each kind of thing lives today, with counts: React contexts and providers, hooks (use*.ts*), helpers (lib/, utils/ and anything else shared), actions/ folders, web and native variant pairs (*.web.ts*, *.ios.ts*). Note every folder the tree has that CLAUDE.md does not name, and every CLAUDE.md layout rule the tree no longer follows. Then what went wrong, from [RECENT_CHANGES]: for each PR, one line with what it did, the folders its diff touched, the tests it added, and the fix-ups, reverts and failed CI runs that followed it. End with the baseline: [CATCH_COUNTS], [LARGE_FILES].

No judgements, no findings: what is, in one page. Return the file path.
```

## What went wrong

```
You review the recent changes to [SCOPE] in the repo at [ROOT] for one thing: where did the structure, a missing test or a missing rule make a change cost more than it had to, or let a bug through? Read CLAUDE.md, the map at [MAP_FILE] and [RECENT_CHANGES], then every PR's diff (git show <commit> --stat, then the files). Write your findings to [REPORT_FILE]; change nothing else.

For each PR: the files it touched for no reason of its own (a copy of a default, a factory, a seed, a layout line per group); code it copied because the home was not obvious; ownership it misread (a fix-up or a failed CI run tells you); a boundary it crossed that is not one; the test it added and whether that test fails when the behaviour it covers is broken (break it on purpose, one line, reverted after, and run it); the bug a fix-up fixed and the test or check that would have caught it before CI. Each is a finding whose cost is that PR's extra files, extra commits or extra runs, named. Then the pattern across the five: the same kind of extra cost on two or more PRs is the finding to put first.
```

## Reuse, Simplification, Efficiency

Three agents per area, one angle each, modelled on the `simplify` skill's review but over an area instead of a diff. Fill `[ANGLE_TEXT]` with the paragraph for the angle.

```
You review [AREA] (part of [SCOPE]) in the repo at [ROOT] from one angle only: [ANGLE_NAME]. Read CLAUDE.md "Code layout" and the map at [MAP_FILE], then every file in the area. Write your findings to [REPORT_FILE]; change nothing else.

[ANGLE_TEXT]

Work by failure class, not by file: when you find the same thing in several files, that is one finding with every site listed under it, and the fix names the one place the logic should live or the one form it should take. Start from the files the map and [RECENT_CHANGES] show changed most, then the rest.
```

Reuse: `Flag code that re-implements something the codebase already has: a helper in src/utils, src/lib, src/hooks, src/sync or packages/shared, a component in src/components, a test helper under test/helpers; and the same logic written twice inside the area where the copies must change together (a rule both follow, a fix one got and the other needs) or there are three or more. Grep for the existing helper before you flag, and name it. Two copies in independent features that will never change together may stand; say so in Not findings.`

Simplification: `Flag complexity that does not pay for itself: state that could be derived, copy-paste with slight variation, deep nesting, dead code and unused exports knip would miss, an option, parameter, file or abstraction no caller needs yet, a pass-through wrapper (apply the deletion test: would deleting it and inlining its callers be smaller and clearer?), a special case layered on shared infrastructure where a change to the underlying mechanism would be simpler, and a comment that restates the code or promises what the code does not do. Name the simpler form that does the same job.`

Efficiency: `Flag wasted work: repeated reads or queries where one would do, I/O or computation on a render or scroll path, independent async work run one after another, a read of whole rows to use one column, a list rebuilt on every change, a closure that keeps a large scope alive, a transaction held across I/O, a query without the index it needs (read docs and the schema's indexes). CLAUDE.md measures performance by counting work, never by timing it: count statements, rows, renders or files for each finding, with the command or the trace that produced the count. Name the cheaper alternative.`

## Homes and boundaries

```
You review [SCOPE] in the repo at [ROOT] for one thing: does each kind of thing have one obvious home, are the boundaries between folders the ones the code's changes need, and where does the same code live twice because the home was not obvious? Read CLAUDE.md "Code layout", the map at [MAP_FILE], and then the code. Write your findings to [REPORT_FILE]; change nothing else.

The recent changes in the map are evidence: where one of them touched a folder for no reason of its own, that is a finding tied to that PR.

Trace these likely changes through the tree and, for each, list every folder a correct implementation touches:
1. Add a field to a synced collection and show it on its detail screen.
2. Add a new item kind with a list, a detail screen and an edit sheet.
3. Add a setting that syncs with the account.
4. Change how one web variant renders.
5. Add an action to a detail screen's menu.
6. Add a route that also opens inside a sheet.
[OWNER_SCENARIOS]
A folder touched by unrelated changes, or a change that touches a folder CLAUDE.md's layout gives no reason to touch, is a finding: say which change, which folders, and what one home would look like. Touching several folders is fine when each is a boundary the change needs; say which it is.

Then flag:
- A kind of thing with two homes (the map lists where each kind lives). For each, name the one home and what moves.
- A feature importing another feature's internals (a file that is not its screen, hook or context). Count the pairs; propose the rule CLAUDE.md should have (what a feature may import from another) and the eslint restriction that would enforce it, with today's hit count.
- For each folder CLAUDE.md does not name and each layout rule the tree no longer follows (the map lists them): propose the rule change or the code change, not both.
- A route file in app/ that holds logic, a file with two exported components, a hand-written type the schema, a repository or @squidbox/shared already gives.
- Duplication, only when the copies must change together (a fix one copy got and the other needs, a rule both follow) or there are three or more: name the one to keep and the callers to move. Two copies in independent features may stand. Web and native pairs (x.ts and x.web.ts) are not duplicates; flag a pair whose two sides differ in interface or behaviour.
- A pass-through wrapper, or a lib/ or utils/ entry with one caller: apply the deletion test (would deleting it and inlining its callers be smaller and clearer?) and flag it only when the answer is yes.
You may propose moving the furniture. Say what moves, where, and what gets simpler.
```

## Data integrity

```
You review [SCOPE] in the repo at [ROOT] for data integrity. Read CLAUDE.md "Where data is saved", docs/sync-design.md §2a, §4, §8 and §12, the map at [MAP_FILE], then the code. Write your findings to [REPORT_FILE]; change nothing else.

First, the failure scenarios below. For each, write down what the design docs promise (quote the sentence; that is the contract, independent of the code), then trace the code step by step with file:line, then run it: find the test that drives this exact sequence (apps/mobile/test, apps/server/test, the DB suites README.md names) and run it, or write a throwaway test in the app's test folder that drives the sequence against the real repositories or a real database, run it, and delete it before you return. Quote the run's result; a trace is not a run. Where an existing test claims the scenario, break the behaviour on purpose (one line, reverted after) and run it again: a test that stays green does not cover the scenario. A scenario that fails, has no test that drives it, or only a test that stays green when broken, is a risk whose fix is first that test, from the quoted contract, before any structural change.
1. Two devices edit the same record offline, then both sync.
2. The process dies between a record write and its file write, or between two of the writes one change needs.
3. The same sync operation arrives twice, or two arrive out of order.
4. A migration runs on a device with existing local data, including rows the newest code never wrote.
5. An upload is interrupted and retried; the account is switched while it is pending.
6. A device on the previous app version pulls data the newest version wrote (a new field, a new kind, a changed meaning).
[OWNER_SCENARIOS]
Then add two scenarios of your own, taken from the recent changes in the map and from the write paths with the most catch sites: the list above is a floor, not the ceiling. These often fail between components that are each correct alone, so follow the sequence across modules; do not stop at the module boundary.

Then flag:
- Data in the wrong tier: a device setting the user would miss on another device, synced data that is a cache, a local-only field that can reach sync.
- Errors swallowed or silently defaulted around stored data: a catch that returns a fallback, a missing await, a write whose failure nobody sees. Start from the folders the map's catch counts point at.
- Writes to more than one table or file outside one transaction; a record saved before its file, or the reverse, where a crash in between loses either.
- Any place the multi-tenant invariant (§2a) depends on a caller remembering a filter: name the database constraint, policy or server check that would make the mistake impossible instead.
- The sync worker, the repositories and library/merge code where they diverge from §8, and §12 choices the code no longer honours.
- A §8 or §12 behaviour with no test that would fail if it broke, and a fix-up among the recent changes in the map whose bug no test caught: name the test.
- The seeded fuzz tests (test/helpers/fuzzRuns.ts and the e2e fuzz suites): do they shuffle delivery order, replay an operation, and kill the process between two writes? Each fault they cannot inject is a finding; three replicas and small scenarios are enough.
A finding names what is lost or corrupted, and when.
```

## Discoverability by task

Three agents, one default task each, no map; the owner may swap a task in. They do not change anything.

```
You are a coding agent landing cold in the repo at [ROOT]. Your task: [TASK]. Do not make the change. Instead, find everything you would need to touch, and keep a log as you go: every file you open and why, every wrong turn (a place you expected to find it and did not), every name you had to guess, and what one sentence in CLAUDE.md would have saved you. Read CLAUDE.md first, as any agent would. Stop when you are sure of the full list of files, or after 25 file reads. Write the log and the final list to [REPORT_FILE]; change nothing else. Return the number of files opened, the number of wrong turns, and one line on the worst stall.
```

Default tasks: "find where a contact is deleted and everything else that must change when that behaviour changes"; "add a new setting that syncs with the account and shows in Settings"; "find where a post's media is reordered and every place that order is read".

## Rules

One agent, over the whole scope regardless of the owner's scope. It reads the rulebooks and the code that would enforce them; it changes nothing.

```
You review the rules of the repo at [ROOT]: every sentence of CLAUDE.md, and every normative sentence (one that says what the code must do) in docs/sync-design.md, docs/library-ownership-plan.md and the project skills' SKILL.md files. The map is at [MAP_FILE]. For each sentence, decide, with evidence, which of these it is:
- Enforced: a lint rule, the typecheck, a database constraint, a knip setting or a test already holds it (name the rule or test). The sentence can go; CLAUDE.md says a rule a machine holds is not restated in prose.
- Stale: it names a file, folder, script, command or component that no longer exists, or describes a flow the code no longer has (quote the sentence, name what it points to and what is there now).
- Duplicate: another sentence says the same thing (quote both, propose the one wording).
- Contradicted: the code mostly does something else (count the sites that follow the sentence and the sites that don't, with the command). Either the rule or the code is wrong; say which you think and why. This is a decision for the owner, not a fix.
- Misplaced: a fact, a procedure or open work in a rulebook (it belongs in README, a skill or todo.md).
- Vague: an agent could not check it against a file ("keep it clean").
- Missing: a rule the code follows everywhere without a sentence saying so (a convention an agent must guess), and a rule a cold agent would need to find the right code (the task logs in [FINDINGS_DIR]/task-*.md, if present, each end with such a sentence; take them as input).
A sentence that is none of these is fine; do not list it. Quote every sentence verbatim after finding it with grep; never write a sentence from memory. Each kept item is one finding in the common shape below, with Class = the category above; Fix = the exact edit (delete, the merged wording, the new sentence and where it goes); Check = how the next run sees it (a grep for the name, the lint that now holds it). Rank: contradicted and stale first (they mislead the next agent), then missing, then enforced and duplicate (they cost attention on every run).
```

## UX parity

Only when the scope has screens.

```
You review [SCOPE] in the repo at [ROOT] for consistency across features in UI and UX. Read CLAUDE.md "UI / Components", the squidbox-ui skill (its conflicts table and "Checks before calling a screen done"), the map at [MAP_FILE], then the code. Write your findings to [REPORT_FILE]; change nothing else in the tree.

Look before you read: the web preview runs at [PREVIEW_STATE]. Drive it with openWebPreview() and settleAsync() from apps/mobile/scripts/webPreview.mjs (README.md "Web preview") and take a screenshot of every screen in scope at phone size, in its empty, loading, error and full state where you can reach them, into [SCREENSHOT_DIR]. Put each flag you can see (a layout that breaks, spacing or type that differs between two screens doing the same job, a loading or error state unlike the others, a control a keyboard or sheet would cover) in the report with the screenshot's path; a thing you saw outranks a thing you grepped.

Build three inventories first and put them in the report: every button, menu and alert label in scope, grouped by verb (when an earlier report in docs/reviews/ has this inventory, list the labels new since then: a new synonym for an existing act is a finding); for each item kind the map lists, how it is created, edited, deleted, restored and confirmed, and with which components; and, per feature, the count of one-off styles (a colour, size or duration not from styles/designTokens.ts), raw primitives and style spreads, with the command that produced it. The gallery (features/component-gallery) is the contract for src/components: list every exported component without an entry there.

Then flag:
- The same job done differently across item kinds: two verbs for one act (Delete and Remove), two capitalisations, a question mark on one confirm and not another, an edit screen for one kind and in-place editing for another, without a reason in the rules.
- A sheet where the rules say push, or the reverse; a Save button or discard prompt on a screen pushed outside a sheet; a sheet that opens a second sheet.
- A raw primitive or restyled look-alike where a project component exists; a style spread in a screen; a duration or spring not from the motion tokens; a label that names a feature by a second name.
- A screen missing one of the four states, or an icon-only button without a label.
Leave the mock account as you found it: do not save, reset, delete or publish anything that syncs; drive a flow up to the confirm and dismiss it, and say so in the finding. If a step would write, screenshot the step before it and note what the next tap would do.
```

## Consolidate

One fresh agent, after every scanner has returned. It reads findings, never the code beyond what a finding cites.

```
You consolidate an architecture review of [SCOPE] in the repo at [ROOT]. Read, in this order: CLAUDE.md; the map at [MAP_FILE]; [COUNTS_FILE]; [RECENT_CHANGES]; every file in [FINDINGS_DIR] (one per scanner, each a list of findings in one shape; rules.md is the Rules scanner's and feeds section 6); the earlier reports in docs/reviews/ (the latest one's Counts and Outcomes above all). Write [REPORT_FILE] and [DROPPED_FILE]; change nothing else.

Merge every finding across scanners into one finding per failure class: one class is one rule broken in one way, with one fix, however many sites it has (seven delete confirms in seven shapes are one finding; raw Text in 23 files is one finding; a query with two homes and the helpers that followed it are one finding). A site already listed under one class is not listed under another. Keep every site, file:line, under its class: a build agent will work from this list.

Sort into risks (can lose or corrupt data, cross an account boundary or ship a regression; a risk quotes its contract sentence) and friction (everything else). Rank risks by consequence and likelihood, a scenario that failed when run first; friction by recurring cost per change, tied to a recent change where a scanner tied it. Drop what fails a criterion in the scanners' common rules (no cost, enforced already, a choice the rules made on purpose, two independent copies) into [DROPPED_FILE], one line each, without arguing.

For every class a machine could spot, name the check that would keep it from coming back (an eslint selector or import restriction, a script, a test) with today's hit count, and say whether CLAUDE.md or a design doc already states the rule (quote the sentence) or it would be new. A quoted sentence is one you found with grep in the file and copied; a sentence you cannot find is not stated, however well you remember it, and the check is then new. The same holds for every Rule field in a finding. A check for a stated rule is its own S build request (the rule, a negative test that it fires, today's hits fixed); a check for a new rule is attached to the decision that would create the rule.

Write [REPORT_FILE]:
1. The three questions, one paragraph each: what actually went wrong (from the What went wrong and other scanners, tied to the PRs), what could still go badly wrong (the risks), what makes the next change unnecessarily difficult (the top friction).
2. Risks, each in the finding shape, marked OPEN.
3. Friction, ranked, each in the finding shape: a complete build request a build agent can take without reading anything else.
4. Checks: the checks for stated rules (ready to build) and for new rules (attached to decisions), each with its selector or test idea and hit count.
5. Decisions for the owner: at most four, in plain words a non-reader of code can answer, grouped so that one answer settles one theme (a rule and its lint and its moves are one decision), each with a recommendation. Every finding that needs an owner's choice is attached to one of the four or dropped with a reason.
6. Rules: from the Rules scanner, the cold agents' sentences and every new rule a decision would state, one table each: sentences to add (the wording and where), to delete (the lint or test that holds it, or why it is stale), to merge (both quotes and the one wording), and contradicted sentences (the counts; these are decisions). The build for this section is the `tidy-claude-md` skill (deletes and merges) and the `add-rule` skill (adds).
7. Outcomes, when an earlier report exists: each count it recorded, better, same or worse, with both numbers; each finding it fixed, still protected or not; each failure class it reported, gone, same or back.
8. Counts, for the next run: every count a scanner or the counts file produced, with its command.
9. Not findings: a copy of [DROPPED_FILE].

Return one line: risks, friction findings, checks ready to build, decisions, report path.
```

## Common tail for every scanner

```
Rules: what can lose or corrupt data or ship a regression is a risk; everything else is friction. Mark each finding as one or the other; a risk quotes the contract sentence it rests on (a design doc or CLAUDE.md) and its fix names the test first. The repo's own rules (CLAUDE.md, the design docs) win over any general principle; when they conflict, say so and propose which should change. Skip anything the lint, the typecheck or knip already enforces. Before you keep a finding, check it: the code does what you say (open the file); it is not a choice CLAUDE.md, docs/sync-design.md §12 or docs/library-ownership-plan.md made on purpose (an earlier report in docs/reviews/ is evidence, not a decision); a caller has the case; deleting the thing and inlining its callers would not be smaller and clearer; crossing folders costs only when a folder is not a boundary the change needs. One finding is one failure class: one rule broken in one way, with one fix, and every site you found listed under it. Rank by cost; there is no target count, and a finding without a cost is not one.

Each finding has these fields, one line each, in this order, with these labels: Class (one line naming the rule broken and how); Sites (every file:line, or a count with the command that produced it); Rule (the CLAUDE.md or design-doc sentence, or the principle); Evidence (what the code does, quoted or counted); Cost (what gets harder or breaks, in one sentence, tied where you can to a recent change or a scenario); Fix (the target shape in one line); Check (a lint selector, script or test that would keep it from coming back, with today's hit count, or "none: judgement"); Seen next run (a test that fails when the behaviour is broken, a hit count, files a cold agent reads, folders a change touches); Files (what a fix touches); Size (S under an hour, M half a day, L a day or more); Test (the test that covers the behaviour, or the one the fix must add; an M or L fix without a test is not done). End with Not findings: what you checked and did not keep, one line each. Write it to the report file and return one line: finding count, report path.
[ADDITIONAL_FOCUS]
```
