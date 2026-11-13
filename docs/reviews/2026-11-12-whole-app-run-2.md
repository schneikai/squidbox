# Architecture review: whole app, run 2 (2026-11-12, HEAD 00332f9 = main 86ab51a + this branch)

Scope: `apps/mobile/src` (897 files), `apps/server/src` (63), `packages/shared` (43). Inputs: the map, `counts.md` (and run 1's `counts-run1.md`), `recent-changes.md`, 22 scanner files in `findings/` (what went wrong, data integrity, homes, ux parity, reuse ×5, simplification ×5, efficiency ×5, three cold-agent task logs), and the earlier report `docs/reviews/2026-11-12-whole-app.md` (run 1, at fb69b03). Everything below is merged into one finding per failure class; every site a scanner named is under exactly one class. `dropped.md` (copied in section 8) holds what fails a criterion. Paths are relative to `apps/mobile/src/` unless they start with `apps/`, `packages/`, `docs/`, `e2e/` or `test/`.

## 1. The three questions

**What actually went wrong?** Of the five PRs since run 1, three (#97, #100, #101) were one commit each, green, no fix-up. The cost sits in #98 (Post ideas: 121 files, 9 commits, three review fix-ups of 41, 16 and 36 files) and #99 (title pills: 6 commits in an hour, 1 failed and 3 cancelled CI runs). The pattern on both: the same rule written a second time beside its first copy and merged only by a fix-up. The server's placeholder fill had a writing path and a judge path, and the judge copy judged thread posts without the thread until ea6f029 merged them (`apps/server/src/ai/prompts.ts:82,92`); the chat card and the context reader each read mentions until 63dc4c3 added `readMentions.ts`; two floating headers each revealed a title until 4e6e14b shared `useTitleReveal`, after run 43178803947 failed on Playwright finding the pill's second copy of the album name. #98 also wired `idea_settings` by hand through 13 files because nothing types the collection maps (F2), typed a retired prompt's text in three places with the hole found in review (F33), moved three hooks into `hooks/` for one importer, one for a use dropped in the same PR (F8), made the fifth copy of the per-user read (F6), the sixteenth copy of the base columns (F24), a second `Pressable` around a `Card` (F10), four components without a gallery entry (F19), a Reset with no confirm (R5), and was merged while its head's CI run was still queued (R10). #100 edited `components/` for an asset-screen change (F4) and added two more hand-rolled latest-refs (F39). The cold agents: contact delete had no stall (run 1's cascade fix held; the repository is where the log found it); post-media-order took 7 wrong turns (no function is named for a reorder, post code sits in six features, `utils/` is not in CLAUDE.md, `test/.builds/` doubles every grep); the synced-setting agent opened 21 files and found five steps §9's checklist does not list (decision 2c).

**What could still go badly wrong?** Three scenarios failed when run. A per-user record's first save on two devices (every account's `idea_settings`, persona, instructions, model choices and pinned list) loses the earlier device's edit of a field the later device did not touch, because the server's insert gives every unnamed field the record's clock (R3). A contact deleted on a phone where its photo file is missing never deletes on any other device, and the failure row offers no way out (R4). Reset changes on the Post ideas screen and Delete rule in the Rules sheet write to the account with no confirm; the preview's Reset replaced the mock account's prompt in one tap (R5). Restoring a deleted contact still strips its lists and photo links (R1, open since run 1, pinned by an `it.fails` test). Traced, not run (no Postgres here): the server's pull reads 16 collections in 16 autocommit statements, so a push committed between two of them can leave a record behind the cursor for good (R6); `addRule`/`updateRule`/`removeRule` and the instruction saves read the list outside the transaction `saveUserRecord` offers, so a rule pulled from another device in between is overwritten (R7); a camera-roll import whose metadata read throws stores the photo without its date, place and favorite for good (R8); a client migration that real rows refuse ships green because the installed-builds suite upgrades an old database with assets only (R9). And the merge gate is a sentence, not a setting: main has no required check (R10).

**What makes the next change unnecessarily difficult?** The same five things as run 1, none moved and two grew: a record's defaults and samples live in four places (F1); registering a collection is hand wiring in two `Record<string, …>` maps and a hand-kept union (F2, 13 files in #98); read queries have two homes, so 50 of the 168 lines that reach into another feature's internals read a list feature's query (F3; 103 → 168 lines since run 1, +17 from `post-ideas → post-chat`); nine providers are "features" that four lower folders import upward (F4, 24 lines, unchanged); and UI text and primitives have no one shape (seven delete confirms, 13 Title Case labels, 12 bare alert titles, 33 raw `Text` uses plus 18 files on `listTextStyles`, 40 components missing from the gallery). New this run: the one-record-per-user read copied five times on the client and four on the server (F6, F7), 26 hand-typed route strings (F21), the albums repository still inside a feature (F23), and dead exports that `knip`'s configuration hides (F36, 54 names).

## 2. Risks (all OPEN)

### R3 · A per-user record's first save on two devices loses the earlier device's edit of a field the later one didn't touch — M, OPEN
- Class: §7's per-field promise is broken on insert: the server gives every unnamed field the inserted record's clock, so an earlier concurrent edit of that field from another device loses to a default.
- Sites: `packages/shared/collections/mergeRecord.ts:63-69` (insert branch, `sentClocks[field] ?? updatedAt`); `apps/server/src/sync/push.ts:184-189` (`storedClocks`); `sync/userRecord.ts:44-48` (the first save names changed fields only; its comment at :16-20 promises the opposite of what the server does); callers `sync/personaRepository.ts:33`, `ideaSettingsRepository.ts:45`, `modelChoicesRepository.ts:35`, `contactSettingsRepository.ts:31`, `instructionsRepository.ts:40,58`; `library/mergeLibrary.ts:496` (`replayOnto` hits the same branch).
- Rule: §7 "Editing different fields of a record on two devices keeps both edits; editing the same field keeps the later one"; against §6 "a new record is always written whole, whatever its `fields` name" (the sentence to change).
- Evidence: throwaway e2e over the real server (data-integrity scenario 7): A `savePersona({aboutYou})` at S+100, B `savePersona({tone})` at S+50, A then B push → server `tone: ''`, B's sync log "personas …: tone overwritten by server". No test covers it.
- Cost: with `idea_settings` new in #98, every account's first saves are inserts on each device: the switch or prompt one phone set is reverted to the default by the other phone's first save, told only in the sync log; the same for the persona, instructions, model choices and the pinned list.
- Fix: on insert, an unnamed clocked field takes clock 0 (never edited), not `updatedAt`, so any real edit beats the default (`fieldClockColumn`/`storedClocks` already carry per-field clocks; a named field keeps `updatedAt`); the server ships first (§15); §6's "written whole" sentence says the clocks are per field; `userRecord.ts`'s comment stays as it is.
- Check: `apps/server/test/push.merge.test.ts` "an insert naming some fields, then an older edit of an unnamed field from another device: applied" (fails today).
- Seen next run: that test green; `test/twoDevice.e2e.test.ts` "two first saves of a persona keep both fields".
- Files: `packages/shared/collections/mergeRecord.ts`, `apps/server/test/push.merge.test.ts`, `test/twoDevice.e2e.test.ts`, `docs/sync-design.md` §6/§7, `sync/userRecord.ts` (comment).
- Size: M. Test: the push.merge case first (from the §7 sentence), then the two-device e2e.

### R4 · A deleted contact whose photo is missing on this device never deletes anywhere else — S–M, OPEN (decision 1b)
- Class: §6's "files before the push" holds a tombstone back for a file the user can no longer act on: the delete waits forever and the failure row has no way out.
- Sites: `sync/worker.ts:168-173` (`filesToUpload` for a `delete` row), `:197-205` (flag and hold); `sync/fileUploads.ts:20-25` (`MISSING_ON_DEVICE` as a refusal); `sync/readPushFailures.ts:53` (`href` for `upsert` rows only); `sync/outbox.ts:33-41` (a delete coalesced onto the create keeps `avatarFilename` in `fields`).
- Rule: §6 "A `delete` row uploads them too … so no pushed record, live or deleted, names a file the storage lacks" and "The worker never nulls a file field on its own … the user's way out is the record's screen"; §13 "A contact's failed row … opens the contact (its `href`), where the photo can be chosen again or removed".
- Evidence: throwaway run with a fake server refusing the missing file (data-integrity scenario 8): create → sync → delete → `retryFailures` → sync: `pushed []`, outbox `[['delete', 'Contact photo is missing on this device: choose it again or remove it']]`, the failure row has no `href`; the contact is in Deleted here and live on every other device.
- Cost: a delete made on this phone is silently not a delete on the others (a file goes missing after a dev library copy, a restore without the avatars folder, a crash between `makeAvatarAsync` and the record write followed by a later delete); the Library sync row says "1 error" with an instruction the viewer cannot follow.
- Fix (decision 1b; recommended): a tombstone whose file field is missing pushes with that field null (only on a `delete` row), and §6's "never nulls a file field" sentence names the tombstone exception; alternatively the failure row of a `delete` links to the deleted contact and Remove photo works there.
- Check: `test/workerFileFields.test.ts` "a contact deleted while its photo is missing on this device pushes its tombstone" (fails today: nothing pushed).
- Seen next run: that test; `readPushFailures.test` "a failed delete row links to its record".
- Files: `sync/worker.ts`, `sync/readPushFailures.ts`, `docs/sync-design.md` §6, `test/workerFileFields.test.ts`.
- Size: S–M. Test: the workerFileFields case, first.

### R1 · Restoring a contact loses its list memberships and photo links — M, OPEN since run 1 (decision 1a)
- Class: a delete tombstones the edges and the restore clears only the contact's own tombstone; the design has no restore rule for contacts.
- Sites: `sync/contactsRepository.ts` (`remove` cascades to `contactListMembers.tombstoneWhere` and `contactLinks.tombstoneWhere`; `restore` comes from `makeRepository` and clears `deletedAt` only); `features/contacts-context/ContactsProvider.tsx` (`setContactDeleted`, `restoreContact`); `features/contact-list-detail/ContactList.tsx:36-80` (the Deleted list's Restore row); `sync/membershipRepository.ts` (`tombstoneWhere`).
- Rule: §7 "Deleting or purging an asset does not touch its edges, so a restore puts it back where it was" is the only restore rule; `docs/sync-design.md` §10 (~line 931) records the contact rule as open.
- Evidence: run 1's throwaway run (after restore: member and link `deletedAt` set, contact `deletedAt=null`); pinned by `test/contactsRepository.test.ts:57-67`, `it.fails`.
- Cost: a tap on a Deleted row brings the contact back stripped of every photo tag and list, with no confirm and no way back but re-tagging; the tombstoned edges sync, so every device loses them.
- Fix: decide (decision 1a; recommended: restore puts the contact back where it was, as for assets); then `remove` tombstones the edges at the contact's own `deletedAt` clock and `restore` revives exactly the edges whose `deletedAt` equals it, in one transaction, in `contactsRepository.ts`.
- Check: the `it.fails` test loses its mark.
- Seen next run: `contactsRepository.test.ts` "restoring a deleted contact puts it back in its lists and on its photos" green without `it.fails`.
- Files: `sync/contactsRepository.ts`, `sync/membershipRepository.ts`, `docs/sync-design.md` §10, `test/contactsRepository.test.ts`.
- Size: M. Test: the pinned one.

### R5 · A synced setting is deleted or reset with one tap and no confirm, where its siblings confirm — S, OPEN
- Class: two destructive writes of synced persona data skip the confirm the same act has everywhere else.
- Sites: `features/voice/RuleScreen.tsx:80-81` (`handleDelete` → `removeRule` at once; the red "Delete rule" at :95); `features/post-ideas/IdeasSettingsScreen.tsx:59-63` (Reset changes → `setPrompt(builtIn)` → `useSaveAsYouType` writes `prompt: null` to `idea_settings` and syncs). Siblings that confirm: `features/prompt-buttons/PromptButtonScreen.tsx:96`, `features/model-compare/ModelDefaultsActions.tsx:31` via `hooks/useResetChanges.ts:9`, `features/model-verify/ModelScreen.tsx:57`.
- Rule: CLAUDE.md "Synced with the account: what the user makes or sets up and would miss on another device: … the assistant setup, prompts"; `hooks/useConfirmedRun.ts:14` "A confirmed action, like Apply changes for everyone or Reset changes"; `features/instructions/InstructionScreen.tsx:25` says why its own Reset needs none ("× undoes it"), which does not hold on a pushed save-as-you-type screen.
- Evidence: `ux-scripts/s6.log`: Post ideas → typed into the prompt → Reset changes → no `DIALOG` line, the Reset link gone, the mock account's prompt now the built-in (the run's side effect; re-seed to restore); `screens/settings-ideas-post-changed.png` → `settings-ideas-post-reset.png`; `grep -c confirm features/voice/RuleScreen.tsx` → 0.
- Cost: a tap on a red link at the foot of a sheet removes a rule from every device (rules have no Deleted list, no Undo); a tap on Reset changes drops a prompt the user wrote, synced, with no draft to close.
- Fix: `confirmDeleteAsync({ name: rule, also: 'It goes from every device.' })` before `removeRule` (F11's helper); `useResetChanges()` in `IdeasSettingsScreen` as `ModelDefaultsActions` has it.
- Check: none: judgement (2 of 5 `colorPalette: 'danger'` actions today lack a `confirm*` in their handler).
- Seen next run: `grep -c confirm` on both files → ≥1; `e2e/postIdeas.spec.ts` extended: tap Reset changes, expect the `confirm` dialog, dismiss, prompt unchanged.
- Files: `RuleScreen.tsx`, `IdeasSettingsScreen.tsx`, `e2e/postIdeas.spec.ts` (+ `utils/confirmDeleteAsync.ts` from F11).
- Size: S. Test: the e2e extension; `test/confirmDeleteAsync.test.ts` (F11).

### R6 · The server's pull reads 16 collections in 16 statements on 16 snapshots, so a concurrent push can leave a record behind the cursor for good — M, OPEN
- Class: one unit of work split into serial autocommit statements where the design assumes one snapshot; also 16 round trips per sync run and up to 16×`limit` rows read to return `limit`.
- Sites: `apps/server/src/sync/pull.ts:24-36` (`for (const col of Object.values(serverCollections))` with one `await db.select…` each, outside any transaction); 16 collections (`grep -c ": serverCollection(" apps/server/src/sync/collections.ts`).
- Rule: §3 "Within one user's partition, `server_seq` order then equals commit order, so the last seq a pull returns is a safe watermark" (true for one snapshot only).
- Evidence (traced, no Postgres in the container): a push under the advisory lock commits an album (seq a) and its `album_asset` (seq b) between iteration 2 (`albums`) and iteration 4 (`album_assets`); the pull returns b, the cursor moves to ≥ b, and the album at seq a is never pulled unless it changes again. Steady-state pull after every local write (§8, `PULL_LIMIT = 1000`): 0 rows in 16 round trips; a first sync reads ~3N rows for N records.
- Cost: a device can skip another device's record through an ordinary concurrent push and pull (two devices on one account sync on every write); every sync run pays 16 serial round trips to Neon.
- Fix: one statement: `UNION ALL` of the 16 collections' `(collection, server_seq, record)` subqueries (`to_jsonb` minus server-only columns, or `jsonb_build_object` over `wireColumns`), each `WHERE user_id = $1 AND server_seq > $2`, outer `ORDER BY server_seq LIMIT limit + 1`; `hasMore` = a row `limit + 1` came back; §5's per-collection sentence changes; the wire format and cursor rule do not.
- Check: `apps/server/test/sync.test.ts` "a pull reads every collection in one statement" (drizzle `logger` on the test pool counts statements; today 16).
- Seen next run: that test; `push.merge.test.ts` and `push.split.test.ts` (18 `pull(` calls) stay green.
- Files: `apps/server/src/sync/pull.ts`, `apps/server/src/sync/collections.ts` (a `wireJson` per collection), `docs/sync-design.md` §5, `apps/server/test/sync.test.ts`, `apps/server/test/helpers/syncDb.ts`.
- Size: M. Test: the statement-count test plus the existing "pull window + tombstone delivery" case kept green.

### R7 · Rules and instructions are read outside the transaction that writes them, so a rule pulled in between is overwritten — S, OPEN
- Class: a read-modify-write of a list field re-implements, outside the write's transaction, what `saveUserRecord`'s function form does inside it; the write then stores a stale list with a newer clock, which wins per-field LWW.
- Sites: `sync/personaRepository.ts:47` (`addRule`), `:79` (`updateRule`), `:89` (`removeRule`): `(await readPersona(db, userId))?.rules` then `savePersona(db, userId, { rules })`; `sync/instructionsRepository.ts:38` (`saveInstruction`), `:53` (`clearInstructionsEqualTo`): `readInstructions` then `saveUserRecord(…, plainChanges)`. The other three user-record repositories use the function form (`modelChoicesRepository.ts:60`, `ideaSettingsRepository.ts:49`, `contactSettingsRepository.ts:36`).
- Rule: `sync/userRecord.ts:20-23` "`changes` can be a function of the stored record … which then runs inside the save's transaction, so a change based on the stored value (a list, a score) never loses one saved in between"; §8 "a transaction holds [the queue] from BEGIN to COMMIT".
- Evidence: measured (efficiency-sync): `addRule` = 6 statements, `saveInstruction` = 6, where the function form is 5; between the outer select and the transaction any queued unit commits (a pull's `applyChanges`, a second `addRule` from the chat's Add as rule at `features/post-chat/UserMessage.tsx:24`); `Promise.all([addRule(a), addRule(b)])` keeps one rule today (reuse-sync).
- Cost: a rule another device added, pulled while the user saves one here, is gone on every device after the push, with no conflict note (the server sees one newer `rules` value); `clearInstructionsEqualTo` nulls a kind edited in between.
- Fix: the three rule edits and the two instruction saves pass `(stored) => …` (the result codes `present`/`full`/`gone` carried out through a closure variable); `readPersona`/`readInstructions` stay for screens.
- Check: `rg -n "await read(Persona|Instructions)\(db, userId\)" apps/mobile/src/sync` → 5 today, 0 after.
- Seen next run: `test/personaRepository.test.ts` "keeps both rules when two are added at once" and "a rule added while a pull brings another device's rule keeps both" (fail today); `instructionsRepository.test.ts` "clears only the kinds still equal at the write"; `addRule` at 5 statements (`makeMeasuredTestDb`).
- Files: `sync/personaRepository.ts`, `sync/instructionsRepository.ts`, the two tests.
- Size: S. Test: the cases above, written first.

### R8 · A camera-roll import stores a photo with its taken date, location, favorite and original name silently gone — S, OPEN
- Class: a catch returns a fallback around stored data: a failed media-library read is stored as "no metadata" for good and synced.
- Sites: `features/assets-context/getPickedAssetMetadataAsync.ts:23-25` (`catch { return null; }`); `features/assets-context/useAddAssetsFromCameraRoll.ts:49-53` (`isFavorite ?? false`, `takenAt: null`, `originalFilename`, `latitude/longitude ?? null`).
- Rule: CLAUDE.md "What matters most, in order: a beautiful, intuitive UI, data integrity".
- Evidence: the record is built with the defaults and saved and synced like any other (`buildAssetAsync.ts` → `addAssetsAsync`); nothing marks it, retries or alerts; the photo sorts by import time without its date.
- Cost: a Photos permission hiccup, a `ph://` id the picker couldn't resolve or a throwing `getLocation` loses the metadata of every photo in that import on every device; re-importing makes a duplicate.
- Fix: treat a failed read like a failed thumbnail (`buildAssetAsync.ts:51-55`): remove the moved file, skip the photo and tell the user how many were skipped; or keep the import with a local-only "metadata missing" the next open retries.
- Check: `grep -rn "catch {" apps/mobile/src/features/assets-context` → 1 today (this one), 0 after.
- Seen next run: a `useAddAssetsFromCameraRoll` test "a photo whose metadata can't be read is not added (its file removed)".
- Files: the two files, the new test.
- Size: S. Test: the hook's loop with `getPickedAssetMetadataAsync` mocked to throw.

### R9 · A client migration that real rows refuse ships green — M, OPEN
- Class: §15's "never edited once shipped" has no test that applies new migrations to a populated old-build database for every table; the populated upgrade covers assets only.
- Sites: `test/installedBuilds.e2e.test.ts:136-155` (`installedPhone`/`update`), `:344-350` (seed: assets only); `sync/db/client.ts:19-28` (a throwing migration closes the db); `library/sessionLibrary.ts:40-50` (an account library that won't open throws the boot).
- Rule: §15 "Client migrations are append-only: never edited once shipped, never removed" (so a bad one cannot be fixed in place); §8's "A library that won't open gives way to the session's own" holds for a device library only.
- Evidence: with `0038_idea_settings.sql` changed to `ADD more_ideas text NOT NULL` (refused by SQLite on a table with rows), "seeded runs of installed and new apps, with updates mid-run" stays green: the old phone's `instructions` table is empty and SQLite accepts the add on an empty table (checked). All 39 shipped migrations are additive today (`grep -l "__new_" migrations/*.sql` → none; every `ADD … NOT NULL` has a DEFAULT).
- Cost: the first migration fine on a fresh database and refused by one row an older build wrote ships in a build, and on that device the account library never opens again until the next build.
- Fix: `installedBuilds.e2e` seeds one row in every table of the installed build (nullable columns null, JSON columns as that build wrote them) before `update()`; plus a lint over new `.sql` files refusing `ADD … NOT NULL` without `DEFAULT` and `__new_` rebuilds.
- Check: the seeded-every-table update, with the `NOT NULL` break, red; a `scripts/` lint over `sync/db/migrations/*.sql` (0 hits today).
- Seen next run: `installedBuilds.e2e.test.ts` red under the one-line break.
- Files: `test/installedBuilds.e2e.test.ts`, `test/helpers/testDb.ts` (`populateEveryTable(sqlite, schemaOfBuild)`), the lint script.
- Size: M. Test: the extended e2e, first.

### R10 · #98 was merged while its head's CI run was queued, and main has no required check — S, OPEN (decision 4a)
- Class: the rule to keep the checks clean before a merge is a sentence for the agent, not a setting on the branch.
- Sites: PR #98, head f02b1ff: run 43096113515 `queued`, created 2026-11-11T20:26:57Z, merged 07:07:05Z the next morning; `gh api repos/schneikai/squidbox/branches/main/protection` → 404 "Branch not protected".
- Rule: CLAUDE.md "Run `npm run check:all` … before opening a PR or merging into main. Keep both clean"; the ui-flows suite runs only in CI (`ci.yml` `ui-flows`).
- Evidence: f02b1ff changed 36 files (+690/−382: the e2e spec, `AssistantTray.tsx` +208/−44, `chatSessions.ts` +52/−3); the only completed run on the branch was for c5ff1af, the merge of main before those changes; the push run on ba84863 was green afterwards.
- Cost: a regression in those 36 files would have reached main untested; the next PR of that size has the same door open.
- Fix: branch protection on main requiring `check` and `ui-flows` (owner-only GitHub setting; one `todo.md` line proposed in decision 4a).
- Check: the protection API answers with required status checks (today 404).
- Seen next run: every merged PR's head sha has a completed run.
- Files: none in the repo; `todo.md` one line.
- Size: S. Test: none (process).

## 3. Friction, ranked by recurring cost per change

Each is a complete build request. Sizes: S under an hour, M an afternoon, L more. "D" marks a finding that waits on a decision in section 5.

### F1 · A record's defaults and sample records are hand-kept in four places per collection — M
- Class: one source of truth per collection (§9) broken by hand-written default and sample records in the app, two test helpers, the registry guard and the mock seed.
- Sites: `features/albums-context/AlbumsProvider.tsx:24` (`ALBUM_DEFAULTS`), `features/contacts-context/ContactsProvider.tsx` (`CONTACT_DEFAULTS`, `LIST_DEFAULTS`), `features/posts-context/PostsProvider.tsx:57` (`postDefaults`), `utils/assets/buildAssetAsync.ts:13-21` (`ASSET_DEFAULTS`); `test/helpers/factory.ts:9-131` (4 makers), `apps/server/test/helpers/syncDb.ts:55-135` (4 makers), `apps/server/test/sync.test.ts:335-392` (16 samples, 13 inline), `apps/server/scripts/seed-mock.ts:285-453` (16 lists).
- Rule: §9 "Each collection is defined once in `packages/shared/collections/`"; CLAUDE.md "types inferred from … `@squidbox/shared` over hand-written copies".
- Evidence: #81 put `favoritedAt: null` in `factory.ts`, `syncDb.ts` and `seed-mock.ts` beside the descriptor; `grep -rn "favoritedAt: null" apps packages --include=*.ts | grep -v drizzle | wc -l` → 5 (run 1: 6); #98's `idea_settings` sample is written twice (`sync.test.ts:381`, `seed-mock.ts:387`).
- Cost: a required field is a four-to-six file change whose misses surface only in the server DB suite or the next mock seed; the next collection adds its sample in three places.
- Fix: `defaults` on `defineCollection` and one `sampleRecord(collection, over)` in `packages/shared/testing/`, used by `utils/newRecord`'s callers, both helpers, the registry guard and `seed-mock`.
- Check: none: judgement (the guard test below is the net).
- Seen next run: the grep → 1; a field-add diff names no `test/helpers` or `scripts/` file; `sync.test.ts`'s `sample` map gone.
- Files: `packages/shared/collections/define.ts` + 16 descriptors, `packages/shared/testing/sampleRecord.ts` (new), 3 providers, `buildAssetAsync.ts`, `factory.ts`, `syncDb.ts`, `sync.test.ts`, `seed-mock.ts`.
- Size: M. Test: the registry guard builds each sample with `sampleRecord`, so a descriptor whose defaults don't parse fails there; `test/newRecord.test.ts` keeps "a missing field throws, naming it".

### F2 · Registering a collection is hand wiring nothing types: a hand-kept name union, two `Record<string, …>` maps, a label switch, and a §9 checklist that misses five steps — S
- Class: the registry's name union and both table maps are hand-kept strings, so a registered collection without a client table typechecks and its pulled records are dropped without a word; the recipe that lists the steps is incomplete.
- Sites: `packages/shared/collections/registry.ts:46-62` (`CollectionName` union, hand-kept beside the `collections` array, imported nowhere); `sync/clientCollections.ts:43` (`clientCollectionTables: Record<string, CollectionTable>`); `apps/server/src/sync/collections.ts:88` (`serverCollections: Record<string, ServerCollection>`); `sync/worker.ts:453-454` (`if (table) await upsertRows(...)` skips a collection without a table, on purpose for old builds, which also hides a new build's missing entry); `sync/readPushFailures.ts:105` (a label per collection in a `switch` on a string); `docs/sync-design.md` §9 steps 1–4 (misses `packages/shared/index.ts`, the `readPushFailures` label, `seed-mock.ts`, the §10 entry, the client migration command `npx drizzle-kit generate --name …` which lives only in `docs/paged-reads-plan.md`).
- Rule: §9 "Adding a collection" and its guard rail ("runs for every registered collection", server only); CLAUDE.md "types inferred from … `@squidbox/shared` over hand-written copies".
- Evidence: #98 touched 13 hand-edited files for `idea_settings`; the synced-setting task agent found the five missing steps only by grepping the previous collection (26 files) and noted the names differ per layer (`ideaSetting.ts`, `idea_settings`, `ideaSettings`, `ideaSettingsRepository`, `useIdeaSettings`); nothing in `test/` iterates the registry against `clientCollectionTables`.
- Cost: the next collection that misses `clientCollections` passes typecheck, lint and the server suite, and its records never reach the device until someone notices; the next agent copies 26 files by grep.
- Fix: `collections` as a readonly tuple with `CollectionName = (typeof collections)[number]['name']` (the hand-kept union deleted), both maps typed `Record<CollectionName, …>`, the push-failure label a field of the descriptor; §9 lists the five steps and the two generate commands, with one naming line (file singular, table plural, repository/hook plural).
- Check: `npm run typecheck` once the maps are typed (removing `idea_settings` from `clientCollections.ts` passes today); `grep -rn "^export type CollectionName" packages/shared` → 1 today, 0 after.
- Seen next run: the typecheck failing under that removal; a new collection's diff ≤ the §9 list.
- Files: `packages/shared/collections/registry.ts`, `sync/clientCollections.ts`, `apps/server/src/sync/collections.ts`, `sync/readPushFailures.ts`, `docs/sync-design.md` §9.
- Size: S. Test: the type is the test; the server registry guard (`apps/server/test/sync.test.ts` "collection registry guard") stays the behavioural one.

### F3 · Read queries have two homes: `features/<x>-list/<x>Query.ts` and `sync/` — M (decision 2a moves it; the move needs no decision)
- Class: "group by feature" applied to a read every feature of the kind needs, so the kind's query is a list feature's internal file.
- Sites: `features/asset-list/assetQuery.ts` (11 other-feature import lines), `features/post-list/postQuery.ts` (9) + `readPost.ts` (4), `features/contact-list/contactQuery.ts` (9), `features/album-list/albumQuery.ts`, `features/contact-list/contactListQuery.ts`, `features/album-list/readAlbumsInCustomOrder.ts` (imported by `albums-context/moveAlbum.ts:3`, `utils/tools/useResortAlbumsByName.ts:3`), `features/post-list/withPostAssets.ts`; vs `sync/readLiveAlbum.ts`, `sync/postThreads.ts`, `sync/photoContacts.ts`, `sync/matchingIds.ts`, `sync/assetSql.ts`, `sync/readByIds.ts`.
- Rule: CLAUDE.md "Move code to `src/components`, `src/hooks` or `src/lib` only when more than one feature uses it"; the map puts repositories and read hooks in `sync/`.
- Evidence: `grep -rn "features/.*Query'" features | wc -l` → 50 (run 1: 45), every one from another feature; `hooks/useAssetAlbums.ts:3-5` imports `album-list` three times; the post-media-order task agent guessed among six post features before finding the reads in `post-list`.
- Cost: a row-shape change is reviewed against every importer's folder (9 for albums); a cold agent looks in `sync/` and finds half the read; the provider → list-feature import makes `album-list ↔ albums-context` a cycle.
- Fix: `sync/queries/{asset,album,post,contact,contactList}Query.ts` (+ `readPost`, `withPostAssets`, `readAlbumsInCustomOrder`) beside `assetSql`; the list feature keeps its sort/filter options, prepare hooks and rows.
- Check: `grep -rl "features/.*Query'" features | wc -l` → 0; `grep -rn "@/features/" sync | wc -l` stays ≤ 2.
- Seen next run: those counts; the F5 test's baseline down by 50.
- Files: 8 query files, ~50 import lines, `test/{assetQuery,albumQuery,postQuery,contactQuery}.test.ts` import paths.
- Size: M (mechanical). Test: the existing query tests move with the files.

### F4 · Providers the root layout mounts live under `features/`, four lower folders import them upward, and five single-feature components sit in `components/` — M (decision 2a names the home)
- Class: a kind of thing (an app-wide provider) with no named home, placed in `features/` by default; plus feature code in the design-system folder.
- Sites: upward lines (24): `components/LoginForm.tsx:7`, `components/floating-bars/FloatingDetailActionsBar.tsx:10-11`, `floating-bars/SortFilterMenu.tsx:7`, `floating-bars/AccountButton.tsx:4`, `floating-bars/FloatingHeader.tsx:14-15`, `components/AssetImage.tsx:5-7`; `hooks/useHaptics.ts:10`, `hooks/useHasFeature.ts:3`, `hooks/useVisionImageDeps.ts:3`, `hooks/useAssetAlbums.ts:3-5`; `utils/assets/files/useRunWithAssetFiles.ts:10`, `utils/assets/files/withAssetFileAsync.ts:4`, `utils/assets/readVisionImageAsync.ts:3`, `utils/albums/getAlbumSortOrder.ts:3`, `utils/tools/useResortAlbumsByName.ts:3-4`; `sync/fileUploads.ts:4-5`. Providers: `features/{albums-context,assets-context,posts-context,contacts-context,app-settings,cloud,cloud-sync,asset-thumbnail-loader,asset-picker}` (`app/_layout.tsx:95-245`). Single-feature components: `FloatingDetailActionsBar` (asset-detail), `LoginForm` (settings), `FavoriteAlbumIndicator` (album-list), `RowMark` (contact-detail), `ThreadParts` (post-detail, post-list); `features/cloud/assets/*` (7 files, imported by the sync worker).
- Rule: CLAUDE.md "Group by feature … Move code to `src/components`, `src/hooks` or `src/lib` only when more than one feature uses it"; "Build screens from the components in `src/components`".
- Evidence: `grep -rn "@/features/" components hooks utils sync library | wc -l` → 24 (run 1: 24); #100 edited `components/floating-bars/FloatingDetailActionsBar.tsx` for an asset-screen feature; #99 edited `FloatingHeader.tsx`, which renders `features/asset-list/SelectionActions`, together with four list features.
- Cost: by CLAUDE.md's sentence none of the nine is a feature, so a new provider has no home; `components/` reads as the design system but holds asset-screen and settings code, so a feature change edits `components/`.
- Fix: `src/providers/<name>/` (Context, Provider, `use<X>`) for the nine, named in CLAUDE.md; `features/cloud/assets/*` → `utils/cloud-api/assets/`; the five components into their feature; `FloatingHeader` takes `selectionSlot?: ReactNode`.
- Check: eslint `no-restricted-imports` `patterns: ['@/features/*']` in an override for `src/{components,hooks,utils,sync,lib,library}/**` → 24 today, 0 after (new rule: decision 2a).
- Seen next run: the grep → 0; `ls src/providers` → 9 folders.
- Files: 9 folder moves (~40 files) and their import lines, 7 + 5 file moves, `FloatingHeader.tsx` + its 4 screens, `app/_layout.tsx`, CLAUDE.md (via `add-rule`).
- Size: M (mechanical). Test: none change; `npm run typecheck` and `test/routes.test.ts` are the net; a gallery entry for `FloatingHeader` with a `selectionSlot`.

### F5 · A feature imports another feature's internals in 168 lines over 78 pairs, 8 of them cyclic — L in all, S for the rule and the ratchet (decision 2a) D
- Class: no rule says what a feature may import from another, so features reach each other's helpers, queries and rows directly.
- Sites: 274 cross-feature lines; by target kind hook 101, context 4, screen 1, other 168 (45 `.ts` helpers, 42 `.tsx` components, 78 pairs). Top internal targets: `asset-list/assetQuery` 11, `contact-detail/contactFields` 10, `contact-avatar/ContactAvatar` 10, `post-list/postQuery` 9, `contact-list/contactQuery` 9, `post-list/readPost` 4, `post-chat/chatSessions` 4, `contact-list/builtInContactLists` 4, `asset-list/assetHref` 4. Cycles: `album-detail ↔ asset-picker`, `album-list ↔ albums-context`, `contact-detail ↔ contacts-context`, `contact-list ↔ contacts-context`, `contact-list ↔ contact-list-detail`, `contact-list ↔ contact-list-picker`, `post-list ↔ post-detail`, `post-list ↔ posts`. Top pairs: `contact-new → contact-detail` 23, `post-ideas → post-chat` 17 (#98), `album-detail → asset-list` 12, `asset-picker → asset-list` 10, `asset-picker → album-list` 10.
- Rule: new (CLAUDE.md's "Group by feature" implies a boundary but names none).
- Evidence: `grep -rnoE "from '@/features/[^/']+/[^']+'" features` (from ≠ to); `ContactsProvider.tsx:13-14` imports the detail screen's field table and the list screen's built-in lists; run 1 counted 103 lines over 66 pairs.
- Cost: a rename inside a feature breaks up to 10 other features; a kind's context can't be read without its list screen; `contactFields` is one feature's internal and three features' dependency, so nobody owns its shape.
- Fix: the rule "A feature imports from another feature only its screen (`*Screen`), its hooks (`use*`) and its context; a component, helper or query two features need moves to `components/`, `utils/` or `sync/`"; with F3 (−50) and F4 (−~10) about 108 lines remain for the per-pair work (`contactFields` → `components/` or a contact domain folder, `contactsOf`/`builtInContactLists` → `sync/`).
- Check: `test/featureImports.test.ts` beside `routes.test.ts`: walks `src/features`, lists every cross-feature import whose target is not `*Screen`, `use*`, `*Context`/`*Provider`, fails above a baseline that only ratchets down (168 → 0). Plain `no-restricted-imports` can't do it (a feature imports its own files by the same alias).
- Seen next run: the baseline; cyclic pairs → 0 (8 today).
- Files: CLAUDE.md, `test/featureImports.test.ts` (new); the moves are F3, F4 and the per-pair work.
- Size: L in all; S for the rule and the test. Test: the ratchet is the test.

### F6 · The one-record-per-user read is copied five times on the client and its live hook has three homes — S
- Class: a pattern (one record per user, read live) with a shared writer (`saveUserRecord`) but no shared reader and no home for its hook.
- Sites: the same `select().from(t).where(and(eq(t.id, userId), isNull(t.deletedAt)))` in `sync/personaRepository.ts:23-29`, `instructionsRepository.ts:18-24`, `modelChoicesRepository.ts:39-45`, `contactSettingsRepository.ts:17-23`, `ideaSettingsRepository.ts:22-28` (#98, the newest); the same hook body in `hooks/usePersona.ts`, `hooks/useInstructions.ts:30`, `hooks/useYourDefaults.ts:32`, `features/post-ideas/useIdeaSettings.ts:15` (imported by `post-detail/Post.tsx:13`); `features/contact-list/usePinnedContactList.ts` folds the read into a list query; `sync/userRecord.ts:35-37` reads the row a sixth way (tombstone included, as it must).
- Rule: §10 "The per-user records are written by `saveUserRecord` (`userRecord.ts`)"; CLAUDE.md "Before writing a new component, hook or helper, check … for one that already does the job".
- Evidence: `grep -rn "eq(t.id, userId), isNull(t.deletedAt)" apps/mobile/src/sync | wc -l` → 5; `grep -rn "userId === null ? null :" . | wc -l` → 4.
- Cost: the sixth setting copies 30 lines in two folders and picks a home by the last one's precedent; a change to what "live" means for a user record is five edits.
- Fix: `readUserRecord(db, table, userId)` in `sync/userRecord.ts` used by the five, `useUserRecord(table, read)` beside `useLiveRecord` used by the four hooks (all in `hooks/`); one sentence in CLAUDE.md "Where data is saved" naming the three files a synced setting adds (descriptor, `sync/<x>Repository`, `hooks/use<X>`) — decision 2c.
- Check: both greps → 0.
- Seen next run: those counts; the next synced setting's diff adds one repository and one hook.
- Files: `sync/userRecord.ts`, 5 repositories, 4 hooks, `sync/useUserRecord.ts` (new), CLAUDE.md.
- Size: S. Test: `test/ideaSettingsRepository.test.ts` and `promptButtonsRepository.test.ts` cover the reads; add "a tombstoned user record reads as null and the next save revives it" to a `userRecord.test.ts`.

### F7 · The server spells the same per-user lookup four times and reads the persona row twice per assistant request — S
- Class: the same where-clause (`and(eq(t.userId, userId), eq(t.id, userId), isNull(t.deletedAt))`) written per reader, so one request reads the same row twice without noticing.
- Sites: `apps/server/src/ai/persona.ts:19`, `ai/instructions.ts:48`, `ai/modelChoices.ts:25`, `:31`; the double read: `ai/chat.ts:29` and `ai/tagging.ts:28` (`readPersona`), then `ai/tasks.ts:185` → `ai/modelChoices.ts:28-32` (`select({ adultContent })` from `personas`, same row).
- Rule: CLAUDE.md "Before writing a new … helper, check … for one that already does the job"; "Small private helpers may live in the same file"; the comment "its id is the user's id" is repeated in `db/schema.ts` ×5, `persona.ts:14`, `instructions.ts:2`, `modelChoices.ts:2`.
- Evidence: `grep -n "eq(\w*\.id, userId)" apps/server/src/ai/*.ts` → 4; statements per `POST /ai/chat` for a non-admin: 6, one repeated; per photo tagged: 5, one repeated.
- Cost: a server reader for `idea_settings` (when the ideas move server-side) copies the clause a fifth time; every chat turn and every photo of an album's Tag it pays one statement for a row the request holds.
- Fix: one `ownRecord(table, userId)` SQL predicate beside the readers; `readChosenModelId` takes the persona's `adultContent` from its caller (`runChosenModelTask` takes `personaAsync` beside `messagesAsync`).
- Check: the grep → 1 (inside the helper); `grep -rn "from(personas)" apps/server/src/ai` → 2 today, 1 after.
- Seen next run: those counts; `test/ai.modelChoices.test.ts` passes `adultContent` in.
- Files: `ai/persona.ts`, `ai/instructions.ts`, `ai/modelChoices.ts`, `ai/tasks.ts`, `ai/chat.ts`, `ai/tagging.ts`, `apps/server/test/ai.modelChoices.test.ts`.
- Size: S. Test: `ai.modelChoices.test.ts` "the variant follows the persona's Adult content switch" takes the switch as an argument; a query count for one chat turn.

### F8 · Files in `hooks/`, `lib/`, `utils/` and the server root that one folder imports, three of them put there by #98 — S
- Class: "move to a shared folder only when more than one feature uses it" broken at creation time; a pass-through kept where inlining is smaller.
- Sites: `hooks/useBreath.ts` (post-ideas only) and `hooks/useShineProgress.ts` (`components/AssistantTray` only): the same `useReduceMotion` + `withRepeat(withTiming)` loop (`grep -rn withRepeat apps/mobile/src` → these two); `hooks/usePagerScrollEnd.ts` + `.web.ts` (moved from asset-detail in ea6f029 for `IdeasCarousel`, whose import f02b1ff dropped; `AssetPager.tsx` is the only importer again); `hooks/useRequiredSheetRoute.ts`, `hooks/useResetChanges.ts` (model-compare only); `lib/applyAppInstructions.ts` (instructions only, 3 lines); `utils/tools/useResortAlbumsByName.ts` (settings only; imports two features); `utils/posts/buildPostAssets.ts`, `utils/posts/postAssetsToAssetRefs.ts` (posts only); `utils/ai/centsText.ts`, `utils/ai/unitCostUsd.ts` (model-verify only); `utils/ai/joinYourModels.ts`, `utils/ai/seedModels.ts` (`hooks/useYourModels` only); `utils/confirmDiscardAsync.ts` (`hooks/useDiscardGuard` only, 10 lines); server `apps/server/src/escapeRegExp.ts` (`ai/compare.ts:43` only).
- Rule: CLAUDE.md "Group by feature … Move code to `src/components`, `src/hooks` or `src/lib` only when more than one feature uses it".
- Evidence: `git log --follow -- hooks/usePagerScrollEnd.ts` → created in ba84863 (#98); the importing-folder count finds 12 `hooks/`+`lib/` files with ≤1 importing folder, 9 pre-existing.
- Cost: the shared folders grow by precedent; a cold agent reading `hooks/` for shared behaviour reads one-user hooks (43 files there today).
- Fix: `useBreath` + `useShineProgress` become one `hooks/useLoop(isOn, timing, { reverse })` (two callers in two folders earn the home); the 12 one-feature files move into their feature; inline `applyAppInstructions` (into `InstructionScreen`), `confirmDiscardAsync` (into `useDiscardGuard`), `useResetChanges` (`useConfirmedRun` in `ModelDefaultsActions`) and `escapeRegExp` (into `compare.ts`); `lucide.ts`, `shuffle`, `formatDateTime`, `formatFullDateTime` stay.
- Check: `test/sharedFolders.test.ts`: for each file in `hooks/`, `lib/`, `utils/`, count the importing folders outside its own; fail when 1 and that folder is one feature → 12 today, 0 after (stated rule: ready to build, C4).
- Seen next run: that count; `ls hooks | wc -l` → 38; `grep -rln withRepeat apps/mobile/src` → 1.
- Files: 12 moves + ~15 import lines, 4 inlines, `hooks/useLoop.ts` (new), `IdeasCarousel.tsx`, `AssistantTray.tsx`, `AssetPager.tsx`.
- Size: S. Test: none needed; `npm run typecheck`, knip.

### F9 · Shared helpers have two homes, `lib/` (15 files, the one CLAUDE.md names) and `utils/` (132, unnamed), and a third in `constants.ts` with a second name for a token — S (decision 2b) D
- Class: the rule names a folder the tree barely uses; the folder the tree uses has no rule; one token carried under two names.
- Sites: `lib/` 15 files; `utils/` 132; `src/constants.ts` (`TAP_SLOP`, `PEEK_DRAG_SLOP`, `DRAG_LONG_PRESS_MS`, `PEEK_AFTER_LIFT_MS`, `DRAG_LIFT_SCALE` used by `components/sortable-grid`, `lib/isPastTapSlop`, `features/posts`; `MEDIA_LIBRARY_ALBUM_NAME` used only by `utils/media-library`; `UPLOAD_MEDIA_FROM_*` by one feature; `SCREEN_PADDING = layout.sideGutter` at :4, 31 uses beside 29 of `layout.sideGutter`: `EditSheet.tsx` pads with one, `SheetSearchField.tsx` above the same sheet body with the other); `lib/createTagAttempts.ts:3` imports `utils/cloud-api/apiErrorMessage` (the only `lib → utils` line); `utils/persistedStore.ts` and `lib/createStore.ts` are the two store makers.
- Rule: CLAUDE.md "check `src/components`, `src/hooks` and `src/lib` for one that already does the job"; "Animate with the `motion` tokens in `styles/designTokens.ts`" (where tuned numbers live); `layout`'s own comment "one kind of thing has one spacing everywhere".
- Evidence: #98 moved `isPastTapSlop` and `sameOrder` into `lib/` while `utils/` holds `toggleItem`, `shuffle`, `tagsDifference` of the same kind; the post-media-order agent did not look in `utils/` because CLAUDE.md never names it.
- Cost: an agent told to check `lib/` finds 15 of 147 helpers; the lib/utils choice is made by the last PR's precedent; a future sheet-gutter token can't be introduced without touching both names.
- Fix: rule change, not a rename of 132 files: CLAUDE.md names `src/utils` (grouped by domain subfolder) as the helper home and `lib/` folds into it (15 moves); the five gesture numbers become `gesture` tokens in `designTokens.ts`, the album name goes to `utils/media-library`, the two upload labels to their feature, `SCREEN_PADDING` is deleted (31 sites read `layout.sideGutter`); `constants.ts` goes.
- Check: eslint `no-restricted-imports` `patterns: ['@/lib/*', '@/constants']` → 45 + 25 hits today, 0 after (new rule: decision 2b); `grep -rn SCREEN_PADDING src` → 31 today, 0 after (stated: tokens live in `designTokens.ts`; ready as N14).
- Seen next run: `ls src/lib src/constants.ts` → gone; both counts 0.
- Files: CLAUDE.md, 15 moves, `designTokens.ts`, `constants.ts`, ~70 + 31 import lines.
- Size: S. Test: none needed (moves, a rename); `npm run typecheck`.

### F10 · Text and surfaces rendered outside the components: raw `Text` in 21 feature files, `listTextStyles` as a second role system in 18, `Pressable` around `Card` twice, one raw `Modal` — M
- Class: list rows, cards and one sheet restyle the primitives by hand instead of using the component; the text roles are defined three times.
- Sites: react-native `Text` in 21 feature files, 33 uses (`grep -rlE "import \{[^}]*\bText\b[^}]*\} from 'react-native'|Text as RNText" features`; per feature: album-detail 1/2, album-list 3/4, asset-detail 2/3, cloud-sync 1/2, contact-avatar 1/1, contact-detail 2/3, contact-list-picker 1/1, contact-list 3/5, contact-new 1/3, model-compare 1/3, new-post 1/1, post-assets-editor 1/1, post-list 1/1, post-mentions 1/2, posts 1/1); `styles/listTextStyles.ts` (5 roles) imported by 18 files (`components/Button.tsx`, `TagsSection.tsx`, `ThumbnailRow.tsx`, 15 under `features/`: album-list ×3, contact-detail ×2, contact-list ×2, asset-detail, cloud-sync, contact-list-picker, model-compare, post-assets-editor, post-list, post-mentions, posts); `components/settings-list/SettingsList.tsx:822-838` (`rowLabel`/`rowDescription`/`rowValue`, a third set); `TagsSection.tsx:1476` (an error in grey `listTextStyles.subtitle` where `Text` has `error`); `Pressable` 19 sites in 17 files, of which around a `Card`: `features/post-ideas/IdeasCarousel.tsx:106-120` (#98) and `features/new-post/NewPostCard.tsx:16-28`; `features/post-chat/EditableLine.tsx:24,45` (`opacity: 0.6` by hand for `press.flat`); `features/contact-avatar/ContactAvatar.tsx:245`, `components/IntroText.tsx:42`, `components/Chip.tsx:224` (`fontWeight: '600'` literals); `features/cloud-sync/cloud-sync-control/SyncErrorViewer.tsx:47` (`<Modal presentationStyle="pageSheet">`, rows as raw `Pressable` + `RNText`).
- Rule: CLAUDE.md "Build screens from the components in `src/components`. Don't recreate their look with styles or use low-level primitives … in features when a project component exists"; "Open a sheet (a route with `presentation: 'modal'`, framed by `components/sheet-route`)".
- Evidence: `listTextStyles.name` = `Text` `title`, `.detail` = `status`, `.caption` = `label`, `.subtitle` = `hint` (+ `marginTop`); only `.title` has no variant; `grep -n "onPress" components/Card.tsx` → 0, so every pressable card wraps it and two features did it two ways.
- Cost: a type-scale change in `Text` misses 33 sites and 18 files; the next pressable card is a third shape; the Sync errors sheet has no sheet frame, discard guard or back parity.
- Fix: `Text` takes over `listTextStyles`' roles (a `row` variant; `subtitle`'s `marginTop` becomes the row's `gap`), `listTextStyles.ts` and `SettingsList`'s third set go; `Card` takes `onPress` (one pressed style, `press.flat`) and `IdeasCarousel`'s MoreCard and `NewPostCard` use it; `EditableLine` uses `press.flat`; `SyncErrorViewer` becomes a route `settings/sync/errors` with `SHEET_OPTIONS`, rows as `settings-list/Row`; raw `Text` allowed only in `components/` and in a file that says why.
- Check: eslint `no-restricted-imports` for react-native `Text` and `Modal` and for `@/styles/listTextStyles` in `src/features/**` → 21 + 1 + 15 today, 0 after (stated rule: C2, shipped as a ratchet with an allowlist of today's files so it lands before the M fix); `grep -rn "<Pressable" features | grep -B1 "<Card"` → 0.
- Seen next run: the lint at 0; `grep -c "onPress" components/Card.tsx` → ≥1; `styles/listTextStyles.ts` absent.
- Files: the 21 + 15 files, `components/Text.tsx`, `Button.tsx`, `TagsSection.tsx`, `ThumbnailRow.tsx`, `SettingsList.tsx`, `Card.tsx`, `IdeasCarousel.tsx`, `NewPostCard.tsx`, `EditableLine.tsx`, `SyncErrorViewer.tsx`, `app/(main)/(tabs)/settings/_layout.tsx`, `.eslintrc.js`.
- Size: M. Test: the lint; a UI-suite snapshot per `Text` variant on the gallery screen; a gallery specimen "Card · pressable".

### F11 · Delete confirms: eight sites, seven shapes, two actions with a noun, the media noun capitalised — S
- Class: one act (delete) confirmed in seven shapes, none shared.
- Sites: `features/post-detail/actions/MoreAction.tsx:34` ("Delete Post", "Are you sure…"), `features/album-detail/actions/MoreAction.tsx:20` ("Delete Album?"), `features/asset-list/AssetsScreen.tsx:67` ("Delete 1 item?"), `components/floating-bars/FloatingDetailActionsBar.tsx:78-90` (`Delete ${humanizeMediaType(…)}` → "Delete Photo", "Are you sure…"; `:73-74` "Restore Photo"), `features/contacts-context/useDeleteContact.ts:21-23` ("Delete <name>?", action "Delete contact"), `features/contact-list-detail/ContactListMenu.tsx:25-27` ("Delete <name>?", action "Delete list"), `features/prompt-buttons/PromptButtonScreen.tsx:97` ("Delete “<name>”?"), `features/album-detail/DeletedAssetsAlbum.tsx:64` ("Delete all" / "Delete selected", no "?"); the capitalised noun from `utils/assets/humanizeMediaType.ts:10-16` ('Photo', 'Photos', 'Video', 'Videos'), also "1 Photo" on the editor (`post-assets-editor/PostAssetsEditor.tsx:23`) and "7 Assets" on the album (`album-list/albumAssetCountText.ts:5`).
- Rule: CLAUDE.md "One name per feature or label, in every text that mentions it"; squidbox-ui "A design change is a deliberate change to a shared component or token, never a screen-local exception".
- Evidence: `grep -rnE "title: ['\`]Delete|title=\{?['\`]Delete" features components | wc -l` → 7 (run 1: 7); Title Case on 2, "?" on 5 of 8, "Are you sure" on 2, the noun in the action on 2, curly quotes on 1; R5's two sites are what copying the nearest example produced.
- Cost: an agent copying the nearest example keeps producing an eighth shape; the user reads a different dialog for the same act on every kind.
- Fix: `utils/confirmDeleteAsync({ name | count, noun?, also? })` → title "Delete <name>?" / "Delete N photos?", action "Delete", message only when something beyond the item goes; `humanizeMediaType` returns lower case and callers capitalise at a sentence start; `albumAssetCountText` → "N photos" / "N items".
- Check: `grep -rnE "title: ['\`]Delete" features components` → 0 outside the helper (today 7); new rule for the shape (decision 3).
- Seen next run: Inventory 1 "Confirm titles" has one Delete shape; `grep -rn "'Photo'" utils/assets/humanizeMediaType.ts` → 0.
- Files: the 8 sites, `utils/confirmDeleteAsync.ts` (new), `humanizeMediaType.ts`, `albumAssetCountText.ts`, `e2e/album.spec.ts` (menu strings if asserted).
- Size: S. Test: `test/confirmDeleteAsync.test.ts` (title/action per input, like `test/confirmBackupSignOutAsync.test.ts`).

### F12 · 13 Title Case labels among ~200 sentence-case ones — S (decision 3) D
- Class: a label convention the app follows but no rule states.
- Sites: `asset-detail/actions/MoreAction.tsx:34`, `asset-list/SelectionActions.tsx:10,27`, `album-list/AddToAlbumScreen.tsx:45` ("Add to Album" vs "Add to list"), `post-detail/actions/MoreAction.tsx:34` ("Delete Post"), `post-detail/Post.tsx:63,66` ("Posted Albums", "Other Posts"), `new-post/IgnoredPostsScreen.tsx:45` ("Ignored Posts"), `album-list/actions/filter-albums-action/albumFilterOptions.ts:6` ("All Albums"), `asset-list/actions/filter-assets-action/assetFilterOptions.ts:6` ("All Media"), `settings/SettingsScreen.tsx:131` ("Backup & Sync"), `cloud-sync/cloud-sync-control/SyncErrorViewer.tsx:81` ("Retry All"), `cloud/confirmBackupSignOutAsync.ts:19` and `sync-status/FirstSyncScreen.tsx:57` ("Sign Out" vs "Sign out" ×3), `components/LoginForm.tsx:67` ("Sign In"), `constants.ts:22` ("From Device"), `utils/media-library/askForMediaLibraryPermissionViaSettings.ts:5-6` ("YES", "NO").
- Rule: new (CLAUDE.md "One name per feature or label … grep for the name the app already uses" is the nearest).
- Evidence: `screens/post.png` shows "Posted Albums" under "Contacts"; `screens/add-to-album-sheet.png` "Add to Album" over "8 Assets"; 13 hits (run 1: 14).
- Cost: two spellings of one word on one screen; the next agent has an example for either.
- Fix: sentence case everywhere ("Add to album", "Posted albums", "Retry all", "Sign out", "From device", "Open Settings" / "Not now").
- Check: eslint `no-restricted-syntax` `JSXAttribute[name.name=/^(label|title)$/] > Literal[value=/^[A-Z][a-z]+( [a-z&]+)* [A-Z][a-z]/]` and the same on `Property[key.name=/^(label|title|action|text)$/] > Literal` → 13 today, 0 after.
- Seen next run: the selector at 0.
- Files: the 13 sites, `.eslintrc.js`.
- Size: S. Test: the lint.

### F13 · 12 alert titles outside "Couldn't …", success alerts, YES/NO — S (decision 3) D
- Class: a bare word or an exclamation where 27 alerts say "Couldn't <do the thing>"; a success alert where the app's pattern is `haptics.success()` and no alert.
- Sites: "Failed" ×3 (`sync-status/SyncScreen.tsx:51,59`, `settings/SettingsScreen.tsx:67`), "Failed to add assets!" (`asset-list/AssetsScreen.tsx:62`), "Error" and "Copied" (`asset-detail/actions/MoreAction.tsx:26,28`), "Done!" ×2 (`SettingsScreen.tsx:65`, `contact-mentions/useTagPhotosFromMentions.ts:37`), "Stopped" (`components/progress-overlay/useRunWithProgress.ts:62`), "API reachable" / "API error" / "API unreachable" (`SettingsScreen.tsx:77-82`); "YES"/"NO" (`utils/media-library/askForMediaLibraryPermissionViaSettings.ts:4-7`).
- Rule: new (the shape is set by `hooks/useSaveAsYouType.ts:29`, `hooks/useEditSheet.ts:82`, `hooks/useConfirmedRun.ts:26,51`, not by CLAUDE.md).
- Evidence: `grep -rn "Alert.alert("` → 42 sites, 27 "Couldn't …"; `useTagPhotosFromMentions.ts:37` says "Done!" right after `useConfirmedRun`'s pattern was available. New since run 1: none.
- Cost: "Failed" says nothing about what failed; "Done!" is the app's only exclamation; YES/NO belong to no other dialog.
- Fix: "Couldn't add the photos" / "sort the albums" / "rebuild the library" / "copy the link"; successes → `haptics.success()`; "Open Settings" / "Not now".
- Check: eslint `CallExpression[callee.object.name=Alert][callee.property.name=alert] > Literal:first-child[value=/^(Failed|Error|Done!?|Stopped|Copied|API )/]` → 12 today, 0 after.
- Seen next run: the selector at 0.
- Files: the 9 files, `.eslintrc.js`.
- Size: S. Test: the lint.

### F14 · Two names for one act: Retry / Try again / Retry All; Add a X / Add X / New X; Delete contact vs Delete; Remove for a delete — S (decision 3) D
- Class: synonyms for one verb across features.
- Sites: retry: `components/CatalogStatus.tsx:16`, `model-verify/VerifyScreen.tsx:64`, `sync-status/FirstSyncScreen.tsx:76` ("Try again") vs `post-chat/ItSeesRow.tsx:81`, `post-chat/ReplyError.tsx:20` ("Retry") vs `SyncErrorViewer.tsx:81` ("Retry All"). Create: `components/settings-list/AddRow.tsx`, `model-compare/ModelListScreen.tsx:81`, `voice/RulesField.tsx:22`, `prompt-buttons/PromptButtonGroup.tsx:64` ("Add a …") vs `contact-list/ContactListsScreen.tsx:64` ("Add list") vs `contact-list-picker/ContactListPicker.tsx:22,84` ("New list" for the same `Alert.prompt`), `AddToAlbumScreen.tsx:46` ("New album") vs the Albums tab's "Add". Menus: `contact-detail/ContactMenu.tsx:41` ("Delete contact" in the screen's own menu) vs `post-detail/actions/MoreAction.tsx:56`, `album-detail/actions/MoreAction.tsx:54` ("Delete"); `model-verify/ModelScreen.tsx:86` ("Remove" as a danger `Row` inside the section, no confirm).
- Rule: CLAUDE.md "One name per feature or label, in every text that mentions it" (the choice of which name is new: decision 3).
- Evidence: Inventory 1; `screens/contact-more-menu.png` vs `screens/post-more-menu.png`; `screens/settings-model-bottom.png`.
- Cost: the user reads the same act under three names; an agent picks one by proximity.
- Fix: "Try again" everywhere; "Add a <noun>" for every create row/chip and "New <noun>" only as a sheet title; bare verb in a screen's own menu, verb + noun in a row's long-press menu; the model's Remove as an `ActionButtons` danger action at the screen's end with "Remove <model>?".
- Check: `grep -rnoE "['\"](Retry|Retry All)['\"]" features components` → 3 today, 0 after; the create labels: judgement.
- Seen next run: Inventory 1 "Add / create" lists one form per kind.
- Files: 3 retry sites, 4 create sites, `ContactMenu.tsx`, `ModelScreen.tsx`.
- Size: S. Test: none (labels); `e2e/postIdeas.spec.ts` if it asserts "Retry".

### F15 · Relative time written twice, the date format twice, plurals by hand — S (the wording is decision 3's) D
- Class: the app's "… ago" text and its date format each have two implementations that must say the same thing; `pluralizeText` exists and five lines re-spell it.
- Sites: `utils/relativeTime.ts` ("just now", "5 min ago", "3 h ago", "2 d ago", "never"; callers `model-verify/verifySummary.ts:28`, `sync-status/SyncScreen.tsx:69`) vs `utils/date-time/dateToTimeAgo.ts` (moment: "5 minutes ago", "1y 1m ago", a commented-out alternative at :26-27; callers `post-list/PostRows.tsx:46`, `album-list/albumLastPostedText.ts:6`, `posts/PostPostedAt.tsx:36`, `contact-detail/Contact.tsx:84`); `utils/date-time/constants.ts:2` (`DATETIME_FORMAT` 'DD. MMM YYYY') vs `utils/date-time/formatDetailHeaderDate.ts:14` (`sameElse`, the same string); `=== 1 ? '' : 's'` at `dateToTimeAgo.ts:17,21,27,29` and `settings/SettingsScreen.tsx:65`.
- Rule: CLAUDE.md "One name per feature or label, in every text that mentions it"; "check … for one that already does the job" (`utils/pluralizeText`, 20 files).
- Evidence: `screens/new-post-bottom.png` "Posted 1y 1m ago" one card above "Posted 10 months ago"; a Verify from five minutes ago reads "5 min ago" on the model screen and "5 minutes ago" on a post row; `grep -rnE "=== 1 \? '' : 's'|!== 1 \? 's' : ''" src` → 5.
- Cost: the same moment reads two ways on screen; a wording change lands in one.
- Fix: one `dateToTimeAgo(ts, { compact? })` in `utils/date-time` (recommended wording: moment's words; the owner picks in decision 3), `relativeTime.ts` deleted with the dead comment; `formatDetailHeaderDate` reads the constant; the five lines use `pluralizeText`.
- Check: `grep -rln "ago'" apps/mobile/src/utils` → 2 today, 1 after; `grep -rn "DD. MMM" src` → 2, then 1; the plural grep → 0; eslint `ConditionalExpression[consequent.value='s'], ConditionalExpression[alternate.value='s']` (stated: ready, N20).
- Seen next run: those counts; `utils/relativeTime.ts` absent.
- Files: the two time utils, `constants.ts`, `formatDetailHeaderDate.ts`, 6 callers, `SettingsScreen.tsx`.
- Size: S. Test: `test/dateToTimeAgo.test.ts` (new, one case per band and a "1 day ago" / "2 days ago" pair).

### F16 · Library, Albums and Posts have no empty or no-results state; the chat none when empty — S
- Class: the four-states rule met on Contacts, Lists and the pickers only.
- Sites: `features/asset-list/AssetList.tsx:105` (`if (!rows) return null`, nothing for `rows.length === 0`), `features/post-list/PostList.tsx:82` (same), `features/album-list/AlbumsScreen.tsx:46-110` / `AlbumList.tsx`, `features/post-chat/PostChatScreen.tsx:184-224` (an empty chat is a blank page above the composer); vs `contact-list/ContactsScreen.tsx:98`, `ContactListsScreen.tsx:55`, `AddToAlbumScreen.tsx:51`, `AddContactsScreen.tsx:164`, `AddModelsScreen.tsx:76`.
- Rule: squidbox-ui "Four states. Loading, error, empty and content. Never flash the empty state while the first load runs."
- Evidence: `screens/library-search-noresults.png`, `albums-search-noresults.png`, `posts-search-noresults.png` (a bare page under the title) vs `contacts-search-noresults.png` ("No contacts match"); `screens/editor-chat.png`; the gallery shows "No photos yet" (`ComponentGalleryScreen.tsx:395`) that no screen renders.
- Cost: a new account's three main tabs are blank with no hint that + is the way in; a search with no hits looks like a hang.
- Fix: `EmptyState` after `rows` is defined ("No photos yet" / "No photos match", albums, posts); the chat: an `IntroText` or the subject card always.
- Check: `grep -rL "EmptyState" features/asset-list/AssetList.tsx features/post-list/PostList.tsx features/album-list/AlbumList.tsx` → 3 files today, 0 after (stated rule).
- Seen next run: `s1.log` "posts-noresults" contains "No posts match"; same for library and albums.
- Files: `AssetList.tsx` (or `AssetsScreen.tsx`), `PostList.tsx`, `AlbumList.tsx`/`AlbumsScreen.tsx`, `PostChatScreen.tsx`.
- Size: S. Test: extend `e2e/album.spec.ts` and `e2e/newPost.spec.ts` with a search that matches nothing.

### F17 · A screen opened from inside a sheet opens a second sheet (Add to Album, Add contacts, Tags, Create post, the photo picker) — M
- Class: "never a second sheet" broken by every root-level picker route reached from the `(new-post)` and `(compare)` copies of the photo, album and post screens.
- Sites: `app/_layout.tsx:274-283` (`pick-assets`, `add-to-album`, `add-contacts`, `add-to-contact-list`, `album-tags`, `pin-contact-list` and `(chat)` exist only under `(main)` with `SHEET_OPTIONS`); callers inside sheet copies: `features/asset-detail/actions/MoreAction.tsx:15,19`, `features/album-detail/actions/MoreAction.tsx:30,34`, `AlbumHeader.tsx:63`, `features/contact-links/TargetContactsSection.tsx:62`, `features/asset-list/useAssetSelectionActions.ts:38,42`; the chat inside the editor shows × where the rule says Back (`PostChatScreen.tsx:162`).
- Rule: CLAUDE.md "Inside a sheet, more steps push inside it with Back, never a second sheet."
- Evidence: `s6.log` `URL after-add-to-album …/add-to-album?assetIds=…`, `close buttons 2`; `screens/np-add-to-album-second-sheet.png`, `np-create-post-from-photo.png` (run 1 could not drive it; confirmed now).
- Cost: a photo opened from the New post sheet's repost card is two sheets deep after Add to Album; dismissing the outer sheet drops the inner one's state; a route copied under one group and not the others opens differently depending on where it was opened from.
- Fix: copies of the picker routes in the sheet groups (`app/(main,new-post,compare)/add-to-album.tsx` etc.) so `router.navigate` resolves inside the open sheet as a pushed step with Back; the chat's header inside a sheet takes a Back `Button` when `navigation.canGoBack()`.
- Check: `test/routes.test.ts`: for each group in `(main,new-post,compare)`, every route a copied screen navigates to resolves inside that group (6 pickers missing today; stated rule: C11).
- Seen next run: `s6.log` `close buttons` → 1 after Add to Album.
- Files: 6 route files ×2 groups, `app/(new-post)/_layout.tsx`, `app/(compare)/_layout.tsx`, `test/routes.test.ts`, `PostChatScreen.tsx`.
- Size: M. Test: the `routes.test.ts` case (fails when a group lacks a copy).

### F18 · A button inside a button: contact detail rows and repost cards — S (bug today)
- Class: a row that is a `Pressable` holds a `Button`, so the DOM nests `<button>` in `<button>` and VoiceOver reads two.
- Sites: `features/contact-detail/IconRowsCard.tsx:47-72` (each list/location row is a `Pressable` with the trailing Remove `Button` inside; `Contact.tsx:110-119` wires "Remove from <list>"), `features/new-post/RepostCard.tsx:30-43` (a `Pressable` around a `PostRowCard` holding Repost, Later and a `MenuButton`). Run 1's `ContactMenuRow` site is fixed.
- Rule: squidbox-ui "Accessibility. Every icon-only button has an accessibilityLabel; targets are at least 44 pt"; HIG: one accessible element per row.
- Evidence: `screens/contact.png` carries "<button> cannot contain a nested <button>"; `s2.log` prints the tree (`ListsField → IconRowsCard → Pressable → button → … aria-label="Remove from Hiking crew" → button`), 1 line; `s1.log` 0 (the tabs are clean now).
- Cost: invalid DOM on web (hydration error), two buttons per row for VoiceOver, a toast hiding other errors on every contact screen in the preview.
- Fix: the row's `Pressable` ends before its trailing slot (`RowSlots`-style), or the row is not pressable when it has a button; `RepostCard` makes `PostRowCard` the touchable with the buttons outside its press area.
- Check: e2e `page.locator('[role=button] [role=button]')` count 0 on a contact and the New post sheet (today 2 screens; stated rule: C13).
- Seen next run: no "cannot contain a nested" line in `s2.log`/`s3.log`.
- Files: `IconRowsCard.tsx`, `RepostCard.tsx`, `e2e/newPost.spec.ts`.
- Size: S. Test: the e2e assertion.

### F19 · The gallery misses 40 of its components; #98 added four more without an entry — M
- Class: the design-system contract shows none of the sheets, floating bars, status screens or the new `Shine`/`SearchInput`/`PictureRow`/`TagsSection`.
- Sites: `features/component-gallery/ComponentGalleryScreen.tsx` (33 specimens, 8 categories); missing, root 29: `AssetImage`, `BottomSheet`, `CatalogStatus`, `CoverImage`, `EditSheet`, `EditSheetHeader`, `FadeView`, `FavoriteAlbumIndicator`, `FoldingTextInput`, `GradientFill`, `LoginForm`, `MenuButton`, `ModalSheet`, `NameNotesEditSheet`, `PictureRow`, `RowMark`, `RowSlots`, `ScoreDetail`, `SearchInput`, `Shine`, `StatusScreen`, `SuperPressable`, `TagInput`, `TagsField`, `TagsSection`, `TextEditSheet`, `ThreadConnector`, `ThreadParts`, `ThumbnailRow`; floating-bars 8: `FloatingActionsBar`, `FloatingDetailActionsBar`, `FloatingHeader`, `FloatingNavigationBar`, `FloatingPrimaryAction`, `SearchOptionsBar`, `SearchSortFilterBar`, `SortFilterMenu`; `popup-menu-options/MenuOption`, `settings-list/AddRow`, `sortable-grid/SortableGrid`.
- Rule: no stated sentence (new rule, decision 3; CLAUDE.md only points at the gallery); squidbox-ui names `ModalSheet`, `ModalHeader`, `EditSheet`, `TextEditSheet`, `ThumbnailRow`, `StatusScreen`, `FloatingHeader`, `SearchOptionsBar`, `SortFilterMenu` as the ones to reuse "before adding new ones".
- Evidence: `screens/gallery*.png`; the name grep; run 1: 26 root (34 with subfolders), today 40; #98 did add `OptionCard`, `AssistantTray` and the `lead`/`raised` chips.
- Cost: an agent cannot see what a sheet, a floating bar or a pressable card should look like without opening a feature, so it copies a feature's local variant (F10, F18 are the result).
- Fix: Sheets (the three edit sheets with Add/Save off and on), Floating bars (header, detail header, actions bar, search/sort bar, the menu live), Status, Lists (`ThumbnailRow`, `PictureRow`, `RowMark`, `RowSlots`, `AddRow`), Inputs (`SearchInput`, `TagsField`, `TagsSection`, `FoldingTextInput`), Surfaces (`Shine`, `MenuButton`).
- Check: `test/galleryCoverage.test.ts`: every default export under `components/` (minus contexts, providers, hosts, `octopus/*`, `sheet-route/*`, `quick-view/*`, `progress-overlay/*`, `*Cell*`) occurs by name in the gallery file → 40 today; as a ratchet it ships now (stated rule: N15).
- Seen next run: the test green; the inventory count at 0.
- Files: the gallery, the new test.
- Size: M. Test: the new test.

### F20 · Which sheet routes are singular is declared per group layout, and a nested group forces a third route copy — S
- Class: one fact (route X is singular) written in every sheet group that holds it; one screen's route files kept in three homes because `(main)/(chat)` can't join the array group.
- Sites: `dangerouslySingular` in `app/_layout.tsx:93,106,107`, `(new-post)/_layout.tsx` (2), `(compare)/_layout.tsx` (2), `(editor)/_layout.tsx` (1), `(main)/(chat)/_layout.tsx` (1), `(main)/(tabs)/_layout.tsx`, `settings/_layout.tsx` (17 lines); route copies: `prompt-buttons/{index,new,[id]}.tsx` under `(editor,new-post,compare)`, `(main)/(chat)` and `settings/assistant` (9 files), `chat/[sessionId].tsx` under two groups.
- Rule: CLAUDE.md "A screen that also opens inside a sheet has a copy in that sheet's group … (`test/routes.test.ts`)" names the copies; nothing names the singular lines.
- Evidence: `(new-post)/_layout.tsx:12-13` and `(compare)/_layout.tsx:10-11` are the same two lines; `routes.test.ts` checks which copy opens, not that a copy is singular everywhere; 17 today (run 1: 17).
- Cost: a new sheet-openable detail screen adds a line to each group that holds it, and a missed group lets a push stack the same screen twice there.
- Fix: `components/sheet-route/SheetStack` takes the singular routes from one map (`sheetRouteOptions.ts`) and renders the `Stack.Screen` lines.
- Check: `routes.test.ts` "every copy of a singular route is singular in its group" (stated rule: C10); `grep -rn dangerouslySingular app | wc -l` → 3 after.
- Seen next run: the count and the test.
- Files: `SheetStack.tsx`, 5 group layouts, `routes.test.ts`.
- Size: S. Test: the `routes.test.ts` case.

### F21 · Route links are hand-typed template strings and hand-joined list params, where `assetHref` / `addToContactListHref` / `lib/listParam` are the pattern — M (the check is decision 2's) D
- Class: the same href written as a template string in several files instead of once in a builder next to the screen it opens; nothing but runtime checks the string.
- Sites: `rg -n "router\.(navigate|replace|push)\(\`/" src/features` → 26: `/contact/${id}` ×7 (`contact-links/TargetContactsSection.tsx:53`, `contact-list/ContactAvatarRow.tsx:33`, `contact-list/ContactRow.tsx:51`, `contact-list/ContactRowMenu.tsx:25`, `contact-new/NewContactScreen.tsx:79,89`, `contact-detail/Contact.tsx:165,181`), `/album/${id}` ×5 (`album-list/StarredAlbumRow.tsx:31`, `AlbumsScreen.tsx:54`, `AssetAlbums.tsx:38`, `album-detail/AlbumHeader.tsx:137`, `album-detail/actions/MoreAction.tsx:26`), `/post/${id}` ×3 (`new-post/NewPostScreen.tsx:80`, `post-list/PostRows.tsx:39`, `PostListItem.tsx:65`), `/contact-list/${id}` ×3 (`contact-list-detail/ContactListMenu.tsx:37`, `contact-list/ContactListRows.tsx:54`, `Contact.tsx:171`), `/settings/assistant/…/${kind}` ×6, `/post-editor/${id}` ×1; `/post-editor` and `/add-to-album` with `assetIds` joined by hand ×4 (`asset-list/useAssetSelectionActions.ts:38,42`, `asset-detail/actions/MoreAction.tsx:15,19`, `new-post/NewPostScreen.tsx:38-47`).
- Rule: CLAUDE.md "Follow the patterns of the code around you" (`features/asset-list/assetHref.ts`, `contact-list-picker/addToContactListHref.ts`); the rule "one href builder per screen" is new.
- Evidence: Expo Router's typed routes are off (`rg typedRoutes app.config.js tsconfig.json` → 0), so none of the 26 strings is checked by `npm run typecheck`; #99 moved list screens and #98 added a sheet group, each a 3-to-7-file grep for a string.
- Cost: a route move is a grep across features; a mistyped route fails only on the device; `routes.test.ts` checks the tree, not the links into it.
- Fix: one builder per entity next to its screen (`contactHref`, `albumHref`, `postHref`, `postEditorHref({ postId | assetIds })`, `addToAlbumHref`), list params joined inside as `assetHref` does; or `experiments.typedRoutes` in `app.config.js` so the strings are type-checked and the builders stay for list params only.
- Check: eslint `CallExpression[callee.object.name='router'] > TemplateLiteral` for `src/features/**` → 26 today (new rule: decision 2a), or typed routes making `npm run typecheck` the check.
- Seen next run: the hit count at 0; `routes.test.ts` gains one case per builder.
- Files: one `*Href.ts` per entity, the 26 + 4 call sites, `test/routes.test.ts`.
- Size: M. Test: extend `routes.test.ts` with the builders' outputs resolving to their routes from each group.

### F22 · Three conventions for a feature's actions, and seven subfolders that hold one file — S
- Class: the same kind (a screen's action) in three shapes, and a folder per action around one file, with 60-character import paths.
- Sites: a file per action: `album-detail/actions/{AddAssetAction,MoreAction}.tsx`, `asset-detail/actions/MoreAction.tsx`, `post-detail/actions/MoreAction.tsx`; a kebab folder per action: `album-list/actions/add-album-action/useAddAlbumAction.ts`, `album-list/actions/filter-albums-action/albumFilterOptions.ts`, `album-list/actions/sort-albums-action/` (6 files), `asset-list/actions/filter-assets-action/assetFilterOptions.ts`, `asset-list/actions/sort-assets-action/assetSortOptions.ts`, `asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction.ts`, `post-list/actions/sort-posts-action/postSortOptions.ts`; flat: `contact-list/useAddListAction.ts`, `contact-list/contactSortOptions.ts`; `cloud-sync/cloud-sync-control/SyncErrorViewer.tsx` (a subfolder of one file).
- Rule: CLAUDE.md "Follow the patterns of the code around you" (there are three to follow); "Group by feature … next to where the code is used".
- Evidence: `find features -path "*actions*" -type f` → 16 files, 6 of 7 kebab folders hold one file; 30 import lines of the form `@/features/asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction` (`Album.tsx:23`).
- Cost: the longest line of every importing file; the next feature picks a convention by what it copies.
- Fix: one shape, the flat one the newest features use: `actions/` folders flatten into the feature (`asset-list/assetFilterOptions.ts`, `album-list/useAddAlbumAction.ts` …); `sort-albums-action`'s six files keep an `albumSort/` folder only if they stay six; `cloud-sync-control/` flattens.
- Check: `find features -mindepth 3 -type d | while read d; do [ $(ls "$d" | wc -l) -le 1 ] && echo "$d"; done` → 7 today, 0 after; `find features -path "*actions*" | wc -l` → 0.
- Seen next run: those counts.
- Files: 17 moves and ~30 import lines; `test/albumQuery.test.ts`, `sortAlbumsByCustomOrder.test.ts`, `sortAlbumsByLastPostedDesc.test.ts` paths.
- Size: S. Test: none; `npm run typecheck`, knip.

### F23 · The albums repository is built in a feature, every other collection's in `sync/`; 36 test sites build their own copy — M
- Class: one collection's writes (`makeRepository('albums')` + `makeEdgeRepository('album_assets')`) and their cascade live in a provider while the other fifteen live in `sync/*Repository.ts`.
- Sites: `features/albums-context/AlbumsProvider.tsx:20-21` (the only app copy), `:100-106` (the album delete cascade, `edges.tombstoneParent` inside the provider's transaction), `:44-48` (the starring's `favoritedAt` rule, a third form beside `sync/assetsRepository.ts:39` and `ContactsProvider.tsx:97`); `makeRepository('albums', …)` in 19 test sites and `makeEdgeRepository('album_assets', …)` in 17 (`grep -rnE "make(Edge)?Repository\('album" apps/mobile/src apps/mobile/test | grep -v .builds | wc -l` → 37; `test/helpers/twoDeviceServer.ts:58` names its own `albumRepo`); twins: `sync/postsRepository.ts:10-15`, `sync/contactsRepository.ts:8-24`.
- Rule: CLAUDE.md "Follow the patterns of the code around you… check … for one that already does the job"; §7/§9 (`fieldGroups: [['isFavorite', 'favoritedAt']]`, "the two merge as one").
- Evidence: 1e4be21 moved the contacts' cascade out of its provider into `contactsRepository.remove`; the albums' cascade stayed in the feature.
- Cost: a rule about album writes has no sync-side home, so the next cascade fix lands in a provider again; 36 private repositories in tests drift from the app's; a fourth favoritable kind copies the lambda again.
- Fix: `sync/albumsRepository.ts` exporting `{ create, update, updateAll, remove, toggle }` and `albumEdges`, `remove` carrying the cascade as `contactsRepository.remove` does; one `toggleFavorite(db, id)` on `makeRepository` in `sync/repository.ts` used by assets, contacts and albums; `AlbumsProvider` and the tests import it.
- Check: `grep -rnE "make(Edge)?Repository\(" apps/mobile/src/features apps/mobile/test` → 37 today, 0 after; `grep -rn "favoritedAt: row.isFavorite\|favoritedAt: updates.isFavorite" .` → 1.
- Seen next run: those counts; `test/albumsRepository.test.ts` passes.
- Files: new `sync/albumsRepository.ts`; `AlbumsProvider.tsx`, `ContactsProvider.tsx`, `sync/repository.ts`, `sync/assetsRepository.ts`; 24 test files' top-level consts.
- Size: M. Test: `removeAlbum tombstones the album and its live edges in one transaction` (from `test/edgesRepository.test.ts:139`); "toggling the favorite records when, and clears it when unstarred".

### F24 · The base columns of a synced record are written by hand in 16 client tables, the server's `assets` table and two edge creators — S
- Class: §2's one record shape restated per table and per creator instead of spread from one definition.
- Sites: `sync/db/schema.ts` (`createdAt: integer('created_at').notNull()` ×16 with `id`/`updatedAt`/`deletedAt`, byte-identical; `idea_settings` pasted them a 16th time in #98); `apps/server/src/db/schema.ts:75-83` (`assets` spells the seven columns `syncableBase()` at :127-139 gives the other 15 tables; the helper's comment points back "see assets.id note"); `sync/edgesRepository.ts:56` (`newEdge`) and `sync/membershipRepository.ts:61` (`created`): `createdAt: now, updatedAt: now, deletedAt: null` literals beside `utils/newRecord`, which gives the base columns and the zod parse every other create gets.
- Rule: §2 "Every synced record, on server and client, carries: id, createdAt, updatedAt, deletedAt … `baseRecordSchema` … defines these"; §9 "Server: add the table … with `syncableBase()`".
- Evidence: `rg -c "createdAt: integer\('created_at'\).notNull\(\)" apps/mobile/src/sync/db/schema.ts` → 16; `grep -c "uuid('id').notNull()" apps/server/src/db/schema.ts` → 2; `rg -n "createdAt: now, updatedAt: now, deletedAt: null" apps/mobile/src` → 2.
- Cost: a base-column change is 16 + 1 copies to keep identical and two literals to find; an edge with an invalid field waits on the outbox as a rejection instead of throwing where it was made.
- Fix: `const baseColumns = () => ({ id, createdAt, updatedAt, deletedAt })` at the top of the client schema, each table `{ ...baseColumns(), … }`; `...syncableBase()` in `assets`; both edge creators call `newRecord(collectionsByName[collection], {}, { id: newId(), ...fields })`. `drizzle-kit generate` on both sides must produce no migration.
- Check: the three counts → 1, 1, 0; `test/migrationsManifest.test.ts` stays green; no new file under `drizzle/` or `migrations/`.
- Seen next run: the counts.
- Files: `sync/db/schema.ts`, `apps/server/src/db/schema.ts`, `sync/edgesRepository.ts`, `sync/membershipRepository.ts`.
- Size: S. Test: the existing edge/membership suites; the registry guard; one case "refuses an edge with an invalid field" if the parse is wanted.

### F25 · "The live record with this id" is written eight ways over `readByIds` — S
- Class: `readByIds` (tombstones included) followed by a hand-written `deletedAt` filter in three spellings, plus one SQL copy, instead of one `readLiveByIds` beside it.
- Sites: `sync/readLiveAlbum.ts:7-8`, `sync/useLiveRecord.ts:17-18`, `sync/assetsRepository.ts:67` (`setTagsOf`), `sync/aiStateRepository.ts:125-133` (`readLiveAssets`: its own select with `inJson` + `isLiveAsset`, re-doing `readByIds`' "once each, in ids order"; three of its four callers are post-chat: `chatTags.ts:4`, `chatContextReader.ts:9`, `useChatTags.ts:11`), `sync/promptButtonsRepository.ts:47-52` (`readPromptButton`, its own select), `sync/backupRun.ts:141-142` (keeps the tombstone on purpose), `features/contact-picker/readAddContactsSeed.ts:42-43,48-49,58-59`, `features/album-tags/useAlbumTagIt.ts:45-46`.
- Rule: CLAUDE.md "Before writing a new … helper, check … for one that already does the job" (`readByIds.ts` is that helper's file).
- Evidence: `grep -rn -A1 "await readByIds(" apps/mobile/src | grep -c deletedAt` → 8; the two asset sites disagree on what "live" is (`deletedAt === null` vs `deletedAt` and `purgedAt`).
- Cost: the next "the X if it is still live" read copies one of three spellings (two were written this month); `readLiveAssets` is found only by someone who knows the model-testing file.
- Fix: `readLiveByIds(db, table, ids)` and `readLiveById` in `sync/readByIds.ts` (live = `deletedAt === null`, which for assets implies `purgedAt === null` since `purged()` sets both); the sites call it; `readLiveAssets` leaves `aiStateRepository` with its test case.
- Check: the grep → 2 after (backupRun, `repository.restore`).
- Seen next run: the count; `readLiveAssets` no longer in `aiStateRepository.ts`.
- Files: `sync/readByIds.ts`, `readLiveAlbum.ts`, `useLiveRecord.ts`, `assetsRepository.ts`, `aiStateRepository.ts`, `promptButtonsRepository.ts`, `readAddContactsSeed.ts`, `useAlbumTagIt.ts`, 3 post-chat imports, `model-compare/ComparePickScreen.tsx`.
- Size: S. Test: `test/aiStateRepository.test.ts:155` moved to `test/readLiveByIds.test.ts` ("a deleted or unknown id is left out, ids once each in order").

### F26 · Two more one-rule-two-forms reads in `sync/`: `readPhotoIdsOf` restates `livePhotoIdsOf`; `sync_meta` JSON is parsed six ways — S
- Class: one predicate in SQL and again in drizzle; one key-value read written per key.
- Sites: `sync/assetSql.ts:124-126` (`livePhotoIdsOf`) vs `sync/readPhotoIdsOf.ts:8-14` (the same WHERE rebuilt; used by contacts-context, contact-picker, album-tags, while `contactQuery.ts:121` uses the SQL); `sync/status.ts:66,97,108,122,139,210` (`raw ? JSON.parse(raw) as T : <empty>` per key, three different empties).
- Rule: CLAUDE.md "Small private helpers may live in the same file"; the brief's "the same logic written twice where the copies must change together".
- Evidence: both docs say "The ids of the live, untrashed photos of an album or post"; a change to the set (say "not the purged either", as `postAlbumAssetIds` already does at `assetSql.ts:173`) must land in both; every `sync_meta` reader throws from `JSON.parse` on a corrupt value into a live query's `console.error`.
- Cost: the album's Tag it writes to one set and the contact query counts another; a guard against a corrupt meta value is six edits.
- Fix: `readPhotoIdsOf` selects from the SQL (`tx.all(sql\`select id from ${livePhotoIdsOf(of)}\`)`); `getJsonMeta<T>(db, key)` beside `getMeta`, the six readers one line each.
- Check: `rg -n "deleted_at is null and id in|isNull\(a.deletedAt\), sql" apps/mobile/src/sync` → 2 today, 1 after; `rg -n "JSON.parse" apps/mobile/src/sync/status.ts` → 6 today, 1 after.
- Seen next run: the counts.
- Files: `sync/readPhotoIdsOf.ts`, `sync/status.ts`.
- Size: S. Test: `contactQuery.test.ts`, `albumTagsDraft.test.ts`, `mergeRun.test.ts` cover the readers; none to add.

### F27 · "Write, then `requestSync()`" is spelled out 16 times across three providers while the fourth has the helper, and four direct writers skip it — S
- Class: the rule that every user write ends with a sync request is re-implemented per method or forgotten; `ContactsProvider` wrote `written(write)` for it.
- Sites: helper at `features/contacts-context/ContactsProvider.tsx:51-55`; inline copies `features/albums-context/AlbumsProvider.tsx:48,57,63,69,77,99,107`, `features/posts-context/PostsProvider.tsx:31,43,47`, `features/assets-context/AssetsProvider.tsx:20,25,36` and its two batch methods (with two local-only methods, `setAssetsSyncError`, `clearSyncErrors`, between them told apart by a comment), `features/photo-tags/editTagsAsync.ts:14`, `features/photo-tags/tagAssetFileAsync.ts:17`; missing: `features/voice/RuleScreen.tsx:70` (`addRule`/`updateRule`), `features/instructions/InstructionScreen.tsx:102,111` (`saveInstruction`), `features/album-tags/AlbumTagsScreen.tsx:63` (`saveAlbumTags`), `features/photo-tags/tagAssetAsync.ts` (`setTags`, via `useRetag`, `chatTags.ts`, `useTagPhotosFromMentions.ts`).
- Rule: §8 "Triggers: After each local write (`requestSync()` from the providers)"; CLAUDE.md "Move code to … only when more than one feature uses it".
- Evidence: `rg -n "requestSync\(\)" src/features/*-context` → 16; `grep -rln "getDb()" features | xargs grep -L requestSync` → 4 writer files among 24.
- Cost: a new provider method is written by copying a neighbour, and whether it syncs depends on which; a rule or a tag made on one phone reaches the other up to 30 s late (`useSyncTriggers`), or at the next launch after a force-quit. Nothing lost.
- Fix: one `syncedWrite(db, write)` in `sync/` that runs the transaction and calls `requestSync()`; every provider method that syncs is one call to it (the two local-only asset methods stand out); the four screens call the matching provider method or `requestSync()` after the write (`useInstructions.ts:51` already does).
- Check: `rg -n "requestSync\(\)" src/features/*-context` → 0 (the helper is the only caller); the `grep -L` → 0 (stated rule: C5).
- Seen next run: those counts.
- Files: `sync/syncedWrite.ts` (new), the four `*-context/*Provider.tsx`, `editTagsAsync.ts`, `tagAssetFileAsync.ts`, the four screens.
- Size: S. Test: none to add (`test/albumMove.test.ts`, `postsRepository.test.ts`, `contactsRepository.test.ts` cover the writes; `requestSync` is a worker trigger with `test/engine.test.ts`).

### F28 · The failure tail (log, error haptic, "Couldn't …" alert) is spelled per hook and per switch screen, each with a different subset — S
- Class: "a write failed: log it, play the error haptic, alert the title with the reason" written out wherever something saves; three one-shot switch saves copy it with three different tails.
- Sites: `hooks/useEditSheet.ts:388-393` (log + haptic + alert), `hooks/useSaveAsYouType.ts:811-815` (same), `hooks/useConfirmedRun.ts:212-215` (haptic + alert, no log), `components/progress-overlay/useRunWithProgress.ts:487-491` (all three), `hooks/useSeedOrClose.ts:936-938` (log + alert, no haptic), `utils/assets/files/useRunWithAssetFiles.ts:418` and `utils/assets/useShareAsset.ts:812` (alert only); one-shot saves `features/post-ideas/IdeasSettingsScreen.tsx:66-69` (log + alert), `features/voice/VoiceScreen.tsx:86-89` (log + alert), `features/prompt-buttons/PromptButtonsScreen.tsx:39-42` (log + haptic, no alert) (`rg -n "then\(requestSync" src` → 3; both #98 screens share the sentence by copy).
- Rule: CLAUDE.md "Give haptic feedback through `hooks/useHaptics` … (… a success or an error)"; "One name per feature or label, in every text that mentions it (… alerts …)".
- Evidence: `grep -rn "Alert.alert(.*apiErrorMessage" src` → 26, of which 4 are preceded by `haptics.error()`.
- Cost: a failed move of a prompt button is felt but not said, a failed ideas switch said but not felt; a fix to one (a Sentry hook later) must be found and repeated in ten places.
- Fix: one `hooks/useFailureAlert()` returning `fail(title, error)` (log, `haptics.error()`, alert `apiErrorMessage(error)`) used by the seven hooks, and one `useSaveNow()` (write → `syncedWrite` from F27, else `fail("Couldn't save your changes")`) for the three screens.
- Check: eslint `CallExpression[callee.property.name='then'][arguments.0.name='requestSync']` → 3 today, 0 after; `Alert.alert(.*apiErrorMessage` outside the helper in `hooks/`, `components/`, `utils/` → 0 (stated rule: C5).
- Seen next run: those counts; `rg -c "Couldn't save your changes" src` 4 → 1.
- Files: `hooks/useFailureAlert.ts`, `hooks/useSaveNow.ts` (new), the 7 hooks, the 3 screens.
- Size: S. Test: one case "`fail()` plays the error haptic and alerts the server's message"; "a failed save alerts and does not request a sync".

### F29 · What went wrong is turned into text by hand at 16 sites on both sides, and six of them are alerts that drop the server's message — S
- Class: `error instanceof Error ? error.message : String(error)` re-spelled per catch, where the server has `errorMessage` and the app has `apiErrorMessage` (the envelope reader, 34 call sites).
- Sites: user-facing (bypass `apiErrorMessage`): `components/LoginForm.tsx:32` (shows "Request failed with status code 401" instead of the server's "Invalid email or password"), `library/switchLibrary.ts:29`, `features/sync-status/SyncScreen.tsx:51,59` (`String(e)`), `features/post-chat/UserMessage.tsx:38`, `features/model-compare/ComparePickScreen.tsx:88`; log text (fine to keep raw, but one helper): `sync/worker.ts:92,95,201,297,571`, `sync/backupRun.ts:165` (its own private `errorMessage`), `sync/sweepPurgedFiles.ts:63`; server: `apps/server/src/contacts/fetchXProfileAsync.ts:47`, `contacts/parseXProfilePage.ts:177` (identical to `errors.ts:57`), `storage/s3.ts:70,84` (a fixed fallback), `ai/venice.ts:201` (a private `errorMessage(body)` meaning Venice's envelope, while `verifyTurns.ts:4`/`verifyRuns.ts:10` import the other).
- Rule: CLAUDE.md "a type the server and the app both need … moves into `packages/shared` instead of being written twice"; "check `src/lib` for one that already does the job".
- Evidence: `rg -n "instanceof Error \? " apps/mobile/src` → 11, `apps/server/src` → 5 (one the helper); the server answers a wrong password with `{ error: { code: 'invalid_credentials', message } }` (`errors.ts:20`).
- Cost: the sign-in screen never shows the server's reason; a change to the envelope reaches 34 alerts and misses 6; the sync log already drifts (`switchLibrary` prints the object).
- Fix: `errorMessage(error: unknown)` in `packages/shared` (beside `chunk`), used by `apps/server/src/errors.ts`, the log sites and `backupRun`; `venice.ts`'s becomes `veniceErrorMessage`; the six alerts use `apiErrorMessage(error)`, which ends with `errorMessage`.
- Check: eslint `no-restricted-syntax` `ConditionalExpression > BinaryExpression[operator='instanceof'][right.name='Error']` on both apps → 11 + 4 today, 0 after (stated rule: C1).
- Seen next run: the lint at 0; a test that signs in against `401 { error: { message } }` asserts the alert's text.
- Files: `packages/shared` (new helper + index), `apps/server/src/errors.ts`, `contacts/fetchXProfileAsync.ts`, `parseXProfilePage.ts`, `storage/s3.ts`, `ai/venice.ts`, the 11 mobile files.
- Size: S. Test: the helper's one case (an Error, a string, an object); `test/apiWithAuthentication.test.ts` extended for the login alert.

### F30 · A prompt's briefing is assembled twice: the creator-and-post block in two default texts, chatVerify's inputs at two call sites, the placeholder regex three times — S
- Class: the same prompt text or input built in two places inside the area where both must change together (#98 added `{thread}` to each by hand).
- Sites: `packages/shared/collections/instruction.ts:110-128` (`writing`) and `:166-182` (`modelCheckJudge`), the same "# The creator … {thread}" block already drifted in wording while `INSTRUCTION_PLACEHOLDERS` (:63-74) names the placeholders once; `apps/server/src/ai/chatVerify.ts:281-287` and `:320-328` (`context`, `persona`, `posts`, `instructions` built for `chatMessages` and again for `judgeMessages`); `apps/server/src/ai/prompts.ts:27`, `:186` (`/\{(\w+)\}/g` twice) vs `:172` (`PLACEHOLDER`).
- Rule: `instruction.ts:41-43` (the judge is asked about "the creator and the post … as `writing` has them"); CLAUDE.md "AI prompts" (built-in texts change only in a PR).
- Evidence: `grep -c "Themes they post about" packages/shared/collections/instruction.ts` → 2; `missingPlaceholders(kind, DEFAULT_INSTRUCTIONS[kind])` run for every kind today: all empty, but no test says so (`grep -rn "INSTRUCTION_PLACEHOLDERS\|missingPlaceholders" apps/*/test` → only the note's wording test); ea6f029's bug (a judge text without `{thread}`) is the shape.
- Cost: the next line added to the briefing lands in `writing` and not in the judge, so a Verify judges a reply against less than the assistant was told; a placeholder syntax change touches three regexes.
- Fix: one `CREATOR_AND_POST_TEXT` constant both default texts are built from; one `briefing` object in `chatVerify` spread into both calls; one `PLACEHOLDERS` regex; and the table-driven test: for every kind in `INSTRUCTION_PLACEHOLDERS`, the built-in text has every placeholder and the server fill appends a missing `{thread}` (replacing the two per-path thread tests in `ai.writing.test.ts`).
- Check: the table-driven test (0 failures today); `grep -c '\\{(\\w+)\\}' apps/server/src/ai/prompts.ts` → 1; `grep -c "isBare ? null : MOCK_PERSONA" chatVerify.ts` → 1.
- Seen next run: the counts; fix-up commits whose message says "one helper" or "through one" → 0 (today 3 of 5).
- Files: `packages/shared/collections/instruction.ts`, `apps/server/src/ai/chatVerify.ts`, `ai/prompts.ts`, `apps/server/test/ai.writing.test.ts`.
- Size: S. Test: the placeholder table test; `test/ai.chatVerify.test.ts:155` stays green.

### F31 · A decorative second copy of a text is a second element to Playwright — S
- Class: a title pill or a shine highlight repeats a text already on the page; `getByText` does not honour `aria-hidden`, so a strict-mode locator resolves to two elements; one spec works around it with `.first()`.
- Sites: `e2e/postIdeas.spec.ts:40-41` (`getByText('Writing ideas…').first()`, "the other is its shine"); `components/Shine.tsx:47-52` (the highlight is a second render of `children`, `aria-hidden`: fine); `components/floating-bars/useTitleReveal.ts:26` (`isMounted`: the fix 4e6e14b made).
- Rule: new (a flow test finds one element per thing; a decorative copy is not a thing) — decision 2c.
- Evidence: run 43178803947 (c744b43) failed in ui-flows: "strict mode violation: … resolved to 2 elements" (`e2e/album.spec.ts:73`); `grep -rn "getByText([^)]*)\.first()" apps/mobile/e2e` → 1.
- Cost: on #99 one failed run, two cancelled runs and a 9-file fix-up; on #98 a spec that passes for the wrong reason and will match the shine, not the title, if their order changes.
- Fix: locate titles and labels by role (`getByRole('heading' | 'button', { name })`), never `getByText(...).first()`.
- Check: the grep → 0.
- Seen next run: the grep; `e2e/album.spec.ts:73` keeps covering the pill's unmount.
- Files: `e2e/postIdeas.spec.ts`.
- Size: S. Test: the two specs.

### F32 · The post-ideas flow spec depends on which photos other spec files have tagged — S
- Class: a test's precondition lives in a constant another file must respect.
- Sites: `e2e/postIdeas.spec.ts:12-13` (`const UNTAGGED = 12;` "the flows that tag photos take the first ones"), `:39` (`pickFromSquidbox(page, 2, UNTAGGED)`), `:45` (`expect(assistant.events).toEqual(['tags', 'tags', 'chat'])`); `e2e/helpers.ts:55` (`from`, added for it).
- Rule: CLAUDE.md "Test behavior a user or another module relies on, one rule per test".
- Evidence: `playwright.config.mjs` `workers: 1` and one `seed:mock` per run, so tags from `album.spec`, `newPost.spec` and the other postIdeas tests persist into this one; nothing checks those flows stop before photo 12.
- Cost: the next spec that tags a thirteenth photo fails with an events mismatch two files away from the cause.
- Fix: the stub's `/ai/tags` route records the asset ids it tagged, and the spec asserts the two picked ids were tagged before the first chat; `UNTAGGED` and `from` go.
- Check: `grep -n "UNTAGGED" apps/mobile/e2e` → 3 today, 0 after.
- Seen next run: the grep.
- Files: `e2e/postIdeas.spec.ts`, `e2e/fixtures.ts`, `e2e/helpers.ts`.
- Size: S. Test: the spec itself.

### F33 · A retired default's text is typed three times: the migration, the boot-time list and a test — S (decision 1c for the §15 sentence) D
- Class: a one-time data fix is a server migration first; the case it cannot reach (an older build seeding the default after the migration) was added later as boot code with the texts copied again.
- Sites: `apps/server/drizzle/0038_retire_default_prompt_buttons.sql` (two ids and texts); `packages/shared/collections/defaultPromptButtons.ts:60` (`RETIRED_PROMPT_BUTTONS`, 63dc4c3); `apps/server/test/promptButtons.retire.db.test.ts:21` (`CAPTION_PROMPT`, a third copy); `sync/promptButtonsRepository.ts:121` (the boot-time delete).
- Rule: §15 "One-time data fixes are migrations, not boot code to delete later" against §15 "A behaviour change keeps the old path for old builds": the repo chose both and the choice holds; the sentence is missing.
- Evidence: 63dc4c3's message ("… for a library an older build seeds after the server's migration"); `grep -rl "Write 3 captions for these photos"` → the SQL, the shared list and the server test.
- Cost: one 16-file fix-up for a hole no test looked for; three copies to keep equal, the SQL's frozen and the test's by hand.
- Fix: the server test imports `RETIRED_PROMPT_BUTTONS` and asserts the migration file holds each id with its text; §15 gets "a retired default is the migration for stored rows and an entry in the RETIRED list for rows an older build seeds later, with the shipped text in `packages/shared` only".
- Check: the assertion in `promptButtons.retire.db.test.ts` (reads the `.sql`).
- Seen next run: `grep -rl "Write 3 captions for these photos" apps packages --include=*.ts` → 1.
- Files: `apps/server/test/promptButtons.retire.db.test.ts`, `docs/sync-design.md` §15.
- Size: S. Test: `test/promptButtonsRepository.test.ts` "deletes a retired default that still holds its shipped text, and keeps an edited one" (verified red when broken) and the DB test.

### F34 · Errors around stored data swallowed with a log — S
- Class: a failure after a successful write is logged and forgotten.
- Sites: `features/posts/AddPostScreen.tsx:35-39` (the repost's `hasBeenReposted` mark fails → `console.error`, the new post stays, the original keeps being suggested); `features/contacts-context/ContactsProvider.tsx:109-114` (`deleteAvatar` is synchronous and after the record write: a throw rejects a change that was saved, a stale file stays); `sync/worker.ts:515` (`retryFailures` failing → warn, the sync still runs).
- Rule: CLAUDE.md data integrity; the brief's "a write whose failure nobody sees".
- Evidence: the catch bodies.
- Cost: a wrong repost suggestion, a stray avatar file, a failed row retried later anyway: no data lost.
- Fix: the repost mark in the same transaction as the new post (`postsRepository`); `deleteAvatar` best-effort in a `try` after the write resolves.
- Check: `grep -rn "console.error(\"Couldn't mark" apps/mobile/src` → 1 today, 0 after.
- Seen next run: the grep; `postsRepository.test.ts` "adding a repost marks the original in one write".
- Files: `AddPostScreen.tsx`, `sync/postsRepository.ts`, `ContactsProvider.tsx`.
- Size: S. Test: the postsRepository case.

### F35 · Web/native pairs whose two sides differ in interface, and nothing checks one against the other — S
- Class: a web variant drops parameters or widens a return type, and the typecheck resolves only the native file.
- Sites: `library/fs.web.ts` (9 of 10 functions drop `library`/`dir`/`from, to`), `utils/assets/assetStorage.web.ts` (`getAssetThumbnailUri`, `getFieldFileUri`, `getAvatarUri` return `string | undefined`; native `string`), `utils/assets/files/deleteStaleDownloadsAsync.web.ts` (drops `library`), `features/contact-avatar/makeAvatarAsync.web.ts` (`..._args: unknown[]`); 13 of 13 web files without `satisfies typeof import`.
- Rule: CLAUDE.md "To see a UI change without a phone, use the web preview" (a check only while the web side keeps the native interface).
- Evidence: `grep -rL "satisfies typeof import" $(find . -name '*.web.ts*') | wc -l` → 13 (run 1: 13).
- Cost: a parameter added natively compiles while the web side ignores it, and the preview differs from the device without a message; a caller written against the web return type is wrong on native.
- Fix: each web file keeps the native signature (unused params `_`-prefixed, same return type) and ends with `satisfies typeof import('./x')`.
- Check: the grep → 0; `npm run typecheck` fails when a web side drifts (new rule: N16, decision 2).
- Seen next run: the grep.
- Files: the 13 `.web` files.
- Size: S. Test: `npm run typecheck`.

### F36 · Dead code `knip` cannot see: 17 schema exports behind a namespace import, 16 server exports with no importer, 7 shared types the barrel hides, 14 exported `Props` nobody imports, two returned fields and one column nothing reads — S
- Class: "Delete code that is merely unused" broken where knip's configuration (`ignoreExportsUsedInFile: true`, no `includeEntryExports`) or a namespace import hides the name.
- Sites: `apps/server/src/db/schema.ts:56-57` (`RefreshToken`), `:123,158,177,197,213,229,243,253,270,286,310,322,361,373` (15 `*Row` types), `:449-452` (`CREATE_CHANGE_SEQ`; `migrate.ts:16` runs its own literal); server `export` with no importer: `ai/tasks.ts:93 readChatReplyLeniently`, `ai/catalog.ts:46 Catalog`, `ai/verifyTurns.ts:19 median`, `:27 withTotals`, `ai/chatVerify.ts:70 SCENARIOS`, `:144 BARE`, `ai/prompts.ts:26 fillTemplate`, `:269 writingBriefingText`, `ai/persona.ts:24 POSTS_IN_PROMPT`, `contract/snapshots.ts:9 SNAPSHOTS_DIR`, `:12 Snapshot`, `config.ts:51 Config`, `contacts/avatarImage.ts:11 AvatarImage`, `storage/resolver.ts:11 StorageResolvableUser`, `sync/purgedFiles.ts:11 DeleteKeys`, `db/pgError.ts:2 DriverError`, `db/client.ts:10 getPool`; shared: `contracts/assets.ts:47-48` (`uploadResponseSchema`, `UploadResponse`: the upload route sends `{ key }` with no `response` schema, so the answer is outside the contract snapshot), `:56,61` (`DeleteAssetsRequest`, `DeleteAssetsResponse`), `contracts/image.ts:8` (`WireImage`), `collections/contactSetting.ts:18` (`ContactSettingRecord`), `collections/favorite.ts:17` (`FavoriteRecord`) (`CollectionName` is F2's); mobile: `export type XProps` with one file: `features/asset-list/AssetListItem.tsx`, `asset-picker/AssetPickerProvider.tsx`, `boot/BootScreen.tsx`, `cloud-sync/CloudSyncProvider.tsx`, `new-post/NewPostCard.tsx`, `new-post/RepostCard.tsx`, `model-compare/PhotoSetRow.tsx`, `model-compare/TweetRow.tsx`, `model-verify/VerifyPhotoRow.tsx`, `photo-tags/PhotoTagsField.tsx`, `photo-tags/PhotoTagsSection.tsx`, `post-assets-editor/PostAsset.tsx`, `post-assets-editor/PostAssetsEditor.tsx`, `voice/RulesField.tsx`; `features/post-chat/useChatSession.ts:25-26` (`session`, `getDraft` returned, read by no caller; the doc promises a use); `sync/db/schema.ts:418-424` (`aiKinds.chosenModelId`, "unused since the picks sync"; local-only, so a migration needs no server step).
- Rule: CLAUDE.md "Delete code that is merely unused"; "Props as `type XProps` above the component".
- Evidence: the server loop in `findings/simplification-server.md` → 33 hits; `npx knip --workspace packages/shared --include-entry-exports` → 7; the `Props` loop in `findings/simplification-features.md` → 14; `grep -rn "chosenModelId" apps/mobile/src apps/mobile/test | grep -v migrations/ | grep -v schema.ts` → 0.
- Cost: a reader of the 452-line server schema takes 17 declarations for the row API; `prompts.ts` advertises 15 exports of which two are file-local; 14 false signals of reuse; a column documented only as "unused".
- Fix: delete the dead lines; declare `response: { 200: uploadResponseSchema }` on the upload route (one line, so the answer joins the snapshot) or delete the schema; drop `export` on the 16 + 14; drop `session`/`getDraft`; migration 0039 drops `chosen_model_id`; `knip.json`: `includeEntryExports: true` for `packages/shared`, `ignoreExportsUsedInFile: false` for `apps/server`.
- Check: `npm run check:all` (knip) with those flags → 0 (stated rule: C7); the two loops → 0.
- Seen next run: knip's hit count; `schema.ts` ≈ 430 lines; `test/migrationsManifest.test.ts` green with 40 migrations.
- Files: the files above, `knip.json`, `apps/server/src/storage/routes.ts`, `sync/db/migrations/0039_*.sql` + manifest.
- Size: S. Test: none beyond typecheck and knip; `contract.test.ts` covers the response schema if added.

### F37 · Pass-through wrappers and options no caller needs, kept beside the general form — M in all, each S
- Class: a layer whose deletion and inlining is smaller and clearer (the deletion test), a parameter only tests pass, or a special case written beside the helper that should take it.
- Sites: `features/asset-list/SortableAssetGrid.tsx` (59 lines: 17 props in, 17 out, renaming four; `AssetGrid.tsx:55-85` re-lists 18 props so both grids accept `AssetList`'s names; `scrollY` accepted and dropped on purpose at :15); `features/model-compare/ModelRow.tsx` (43 lines) and `ModelPickRow.tsx` (41), one caller each (`ModelListScreen.tsx:68-79`, `ComparePickScreen.tsx:108-119`) listing the same 8 summary props a third time; `features/posts/ThreadPost.tsx:16-20,36-40,49-53` (five props exist only to reach `PostRowCard`); `features/album-detail/useAlbum.ts` (one line over `useLiveRecord`, with its own test); `sync/membershipRepository.ts:111-112` (`add` = `addToEach` of one parent, no `src` caller), `:115-120` (`remove` re-implements `removeFromEach` for one parent, no `src` caller), `sync/edgesRepository.ts:235-237` (`tombstoneParent` = `tombstoneParents([id])`, one caller `AlbumsProvider.tsx:105`); `sync/api.ts:10-18` (two exports, one caller each in `transport.ts:18-19`); `apps/server/src/ai/verifyRuns.ts:167-170` (`stopAbandonedRuns` = `stopStaleRuns`; caller `index.ts:17`); `utils/date-time/getTimestamp.ts` (`new Date().getTime()`; 5 callers beside 31 `Date.now()`); `utils/assets/assetStorage.ts:11-18` and `assetStorage.web.ts:8-15` (identical re-exports of six `assetDirectories` helpers; no file imports `assetDirectories` directly); `features/post-chat/seesLine.ts:15` (`noTags = 'no tags'`, only `test/seesLine.test.ts:16` passes it), `features/post-ideas/ideasRun.ts:41` (`foldedAt = null`, only tests omit it); `packages/shared/collections/define.ts:27,50,57,65` (`L extends z.ZodRawShape`, bound by no caller; `localOnly` read once as `Object.keys`); `apps/server/src/ai/routes.ts:292-293` (`PUT /ai/uncensored` re-implements `requireModel` because its `kind` can be null, while `requireModel`/`catalogModel` at :101-114 could take `AiModelKind | null` like `findModel`).
- Rule: CLAUDE.md "Delete code that is merely unused"; "Follow the patterns of the code around you"; the brief's deletion test.
- Evidence: each site's caller count as quoted; `grep -rnE "(contactLinks|contactListMembers)\.(add|remove)\(" apps/mobile/src` → 0; `grep -rn getTimestamp src` → 6.
- Cost: every new grid prop is added in three places; the 8 model-summary props are typed four times; a reader of the push path follows `worker → transport → api → apiWithAuthentication` for two `post` calls; a change to how a removal reads edges (as in 1e4be21) must be made in `remove`, `removeFromEach` and `tombstoneWhere`.
- Fix: `AssetList` takes `SortableGrid`'s prop names and `AssetGrid` renders one `gridProps` into either, `SortableAssetGrid` deleted; `ModelRow`/`ModelPickRow` deleted, the screens render `<Row label={<ModelListSummary {...row} …/>} …/>`; `ThreadPost` spreads a `Pick<PostRowCardProps, …>`; `useAlbum` folds into F38's hook; `add`/`remove`/`tombstoneParent` deleted, tests call the list forms; `api.ts` inlined into `httpTransport`; `stopStaleRuns` exported, the wrapper gone; `getTimestamp.ts` deleted; the two re-export blocks deleted and four importers point at `assetDirectories`; `seesLine` and `ideasRun` lose the defaults (the test's `run()` helper passes `null`); `localOnly: z.ZodRawShape`, `L` dropped; `requireModel`/`catalogModel` take `AiModelKind | null`.
- Check: `grep -rn "import SortableAssetGrid\|import ModelRow\|import ModelPickRow" src` → 0; `test -e sync/api.ts` false; `grep -c stopAbandonedRuns apps/server/src` → 0; `grep -rln getTimestamp src` → 0; `grep -c "from './assetDirectories'" utils/assets/assetStorage*.ts` → 0; `rg -n "L extends z.ZodRawShape" packages/shared` → 0; `grep -n "findModel(" apps/server/src/ai/routes.ts` → 1.
- Seen next run: those counts.
- Files: the files above; `features/album-detail/DeletedAssetsAlbum.tsx`, `features/asset-picker/AssetPickerScreen.tsx:43`, `test/membershipRepository.test.ts`, `contactQuery.test.ts`, `assetQuery.test.ts`, `pushFailures.test.ts`, `readAddContactsSeed.test.ts`, `edgesRepository.test.ts:139-147`, `test/seesLine.test.ts`, `test/ideasRun.test.ts`, `apps/server/test/ai.verification.db.test.ts`, `apps/server/src/index.ts`.
- Size: M in all. Test: `npm run typecheck`; `test/routes.ai.test.ts:1047,1075` (the uncensored route); web preview of Library, an album drag, the picker.

### F38 · `useX(id)` + `useCloseWhenGone(x, 'This X was deleted')` repeated in every detail screen — M
- Class: copy-paste with slight variation; the live-record read and the close-on-null line paired nine times, differing only in table and noun.
- Sites: `features/album-detail/AlbumScreen.tsx:11-12`, `AlbumPostsScreen.tsx:15,19`, `AlbumEditScreen.tsx:12,14` (via `useAlbum`); `features/contact-detail/ContactScreen.tsx:11-12`, `ContactPlaceScreen.tsx:16,18`, `ContactPhotosScreen.tsx:18-19`; `features/contact-list-detail/ContactListEditScreen.tsx:13,15`, `ContactListScreen.tsx:19-20`; `features/post-detail/PostScreen.tsx:17`.
- Rule: CLAUDE.md "before writing a hook, check `src/hooks` for one that does the job; move to `src/hooks` when more than one feature uses it"; `hooks/useSeedOrClose.ts` already fuses "read + close when gone" for seeds.
- Evidence: `grep -rn "useCloseWhenGone(" features` → 9, each under a `useLiveRecord`/`useAlbum` line; the "was deleted" noun typed per site (three copies of each string).
- Cost: a wording change is a 9-file edit; albums go through a wrapper, contacts and lists call `useLiveRecord` directly: the same thing two ways.
- Fix: `hooks/useLiveRecordOrClose(table, id, message)` = `useLiveRecord` + `useCloseWhenGone`, used by the nine; `useAlbum.ts` deleted (its test renamed to the new hook); `AssetPickerScreen.tsx:43` calls `useLiveRecord` directly.
- Check: `grep -rn -B3 "useCloseWhenGone(" features | grep -c "useLiveRecord\|useAlbum("` → 9 today, 0 after.
- Seen next run: the count.
- Files: the nine screens, `useAlbum.ts` (delete), `AssetPickerScreen.tsx`, `hooks/useLiveRecordOrClose.ts` (new), `test/useAlbum.test.ts` (rename).
- Size: M. Test: `test/useAlbum.test.ts`'s cases on the new hook.

### F39 · The latest-value ref is hand-rolled in nine places while `post-chat/useLatestRef` exists, in two timings — S
- Class: `const ref = useRef(v); ref.current = v;` and its `useEffect` cousin re-implemented where a hook already does it; the effect-based copies update one render later.
- Sites: hook `features/post-chat/useLatestRef.ts` (one caller, `useChatSends.ts:29`); render-time copies `features/asset-list/AssetList.tsx:75-76`, `asset-list/useAssetCells.tsx:38-39`, `photo-tags/usePhotoTagsEdit.ts:20-21`, `asset-detail/details/AssetNote.tsx:34-35`, `asset-detail/useAssetVideo.ts:51-52`, `sync/useLiveQuery.ts:75-76`; effect-based `asset-detail/useZoomGesture.ts:115,127-129`, `asset-detail/usePagerEdgeSwipe.ts:54-58`, `hooks/useSaveAsYouType.ts:35-39`.
- Rule: CLAUDE.md "Move code to … `src/hooks` … only when more than one feature uses it"; "check … `src/hooks` … for one that already does the job".
- Evidence: `rg -n -A1 "= useRef\(" src | rg -c "\.current = "` → 6; #100 (asset-detail) added two more copies; `useZoomGesture.ts:117` has to say "Reported on (re)start too" because of the one-render delay.
- Cost: the next hook copies whichever neighbour it sees and inherits that neighbour's timing (the kind of bug `test/pagerEdgeSwipe.test.ts` exists to pin).
- Fix: move `useLatestRef` to `hooks/useLatestRef.ts`; the nine sites use it (the two effect-based ones keep their timing only with a comment saying why).
- Check: the `rg` → 0 outside the helper.
- Seen next run: the count; `rg -l "useLatestRef" src` → 10 files.
- Files: `hooks/useLatestRef.ts` (moved), the nine sites.
- Size: S. Test: `test/pagerEdgeSwipe.test.ts` and `test/assetZoom.test.ts` pass unchanged.

### F40 · The "switch on its way to the server" state is written twice and disagrees on haptics — S
- Class: two admin screens implement the same switch contract (flip at once, revert if refused, one in flight) with their own `pending` state and try/alert/finally.
- Sites: `features/account-features/FeaturesScreen.tsx:28-41,52-58` with `featureSwitchRows.ts:24-35` (no haptic); `features/model-verify/ModelLabelsSection.tsx:40,50-65,76-80` (`haptics.selection()` / `haptics.error()`).
- Rule: CLAUDE.md "If a UI pattern repeats, extract a component"; "check `src/hooks`".
- Evidence: `rg -n "setPending\(null\)" src` → 3 (the third, `usePhotoTagsEdit.ts:50`, is a pending list, not a switch); both read `pending?.X === X ? pending.isOn : stored`.
- Cost: the two screens already differ in what the user feels; the next server flag gets a third copy.
- Fix: `hooks/usePendingSwitch<K>(change, { errorTitle })` returning `{ valueOf(key, stored), isDisabled, onChange }` with the haptics inside; `featureSwitchRows` keeps only `requires`.
- Check: the `rg` → 1.
- Seen next run: the count; `test/featureSwitchRows.test.ts` loses its pending cases to the hook's test.
- Files: `hooks/usePendingSwitch.ts` (new), the two screens, `featureSwitchRows.ts`, its test.
- Size: S. Test: `test/usePendingSwitch.test.ts` ("the switch shows the pending value until the change settles", "a refused change shows the stored value and alerts once").

### F41 · The sent-mentions memo is written twice between the chat and the tray — S
- Class: one derivation (the mentions already sent to the assistant for this post) with its own `useMemo` in two features.
- Sites: `features/post-chat/usePostChat.ts:26-31`; `features/post-ideas/SeesLine.tsx:27-32`.
- Rule: CLAUDE.md "Before writing a new component, hook or helper, check … for one that already does the job".
- Evidence: both filter the same `mentions` by `sentAt` and map to `handle`; the second was added in f02b1ff (the tray) without seeing the first (what-went-wrong 1).
- Cost: when the "sent" rule changes (say, a resend), one screen shows a different set than the other.
- Fix: `features/assistant/sentMentions.ts` (one pure function) used by both.
- Check: `rg -n "sentAt" src/features --glob '!assistant/*'` → 0 outside the helper.
- Seen next run: the count.
- Files: the two sites, one new file. Size: S. Test: `test/sentMentions.test.ts` ("only mentions sent to the assistant are listed").

### F42 · Nullable comparators are re-spelled per sort — S
- Class: "nulls last, then by value, then by name" written by hand per comparator.
- Sites: `features/albums/albumSortFunctions.ts:11-29` (three comparators); `features/albums/sortAlbumsByLastPostedDesc.ts:6-11`; `lib/sortContacts.ts:8-17`.
- Rule: CLAUDE.md "check `src/lib` for one that already does the job".
- Evidence: five comparators, each with its own `if (a == null) return 1` ladder; two disagree on whether equal values fall back to the name.
- Cost: the sort orders in Settings promise one behavior and the albums tab delivers two.
- Fix: `lib/compareBy(keys: [(x)=>Comparable|null, dir][])` with nulls last once; the five become one-liners.
- Check: `rg -n "== null\) return (1|-1)" src` → 0.
- Seen next run: the count.
- Files: three files. Size: S. Test: extend `test/albumSortFunctions.test.ts` ("albums without a date sort last under every order").

### F43 · Six helpers exist and were written again at one more site each — S
- Class: a `lib`/`shared` helper with a second hand-written copy at one site.
- Sites: `tagKey`/`uniqueTags` (`features/tags/tagKey.ts` vs `apps/server/src/tagVerify.ts:44` lowercasing by hand); `imageDataUrl` (`apps/server/src/tagVerify.ts:44` vs `apps/server/src/chatVerify.ts:61`); `chunk` (`apps/server/src/s3.ts:78` and `apps/server/src/libraryCopy.ts:68`, both inline slicing loops); features SQL (`apps/server/src/users.ts:26` vs `apps/server/scripts/seed.ts:39`); clipboard (`features/asset-detail/actions/MoreAction.tsx:22-30` uses `expo-clipboard` directly where `hooks/useCopyText` exists); a deferred reject (`apps/server/test/uncensoredMarks.test.ts:26-34` vs `test/helpers/deferred.ts`).
- Rule: CLAUDE.md "check `src/components`, `src/hooks` and `src/lib` for one that already does the job"; "Give haptic feedback through `hooks/useHaptics`" names the same principle for haptics (the clipboard copy also skips the "Copied" toast the hook gives).
- Evidence: `rg -n "from 'expo-clipboard'" apps/mobile/src` → 2 (the hook and `MoreAction.tsx`).
- Cost: the copy-text path on the asset's More menu gives no toast and no haptic while every other copy does.
- Fix: each site calls the helper; `chunk` moves to `packages/shared/src/chunk.ts`.
- Check: N13 (eslint `no-restricted-imports` on `expo-clipboard` outside `hooks/useCopyText.ts`) → 1 today; the others are one-offs with no selector.
- Seen next run: the lint at 0; the reuse scanners find no re-spelled helper.
- Files: six sites. Size: S. Test: none new (each helper has its test).

### F44 · A boolean stands where a progress value is wanted, six times — S
- Class: long operations expose `isRunning: boolean` and the screen shows an indeterminate spinner though the operation counts its work.
- Sites: `features/backup/useBackup.ts:40`; `features/library/useResortAlbums.ts:18`; `features/tags/useTagPhotosFromMentions.ts:33`; `features/library-copy/useLibraryCopy.ts:22`; `features/model-verify/useVerifyRun.ts:27`; `features/sync/useSyncNow.ts:14`.
- Rule: CLAUDE.md "a beautiful, intuitive UI" first; the gallery's `ProgressOverlay` takes `fraction`.
- Evidence: `rg -n "ProgressOverlay" src/features | rg -c "fraction"` → 1 of 6 callers passes a fraction; five pass nothing.
- Cost: the backup of a large library shows a spinner for minutes with no sign it moves (ux-parity).
- Fix: `hooks/useProgress()` returning `{ start(total), step(), done(), fraction }`; the six hooks step it; `ProgressOverlay` gets the fraction.
- Check: `rg -n "<ProgressOverlay" src | rg -vc fraction` → 0.
- Seen next run: the count.
- Files: seven. Size: S. Test: `test/useProgress.test.ts` ("the fraction follows the steps and ends at 1").

### F45 · Subscribe/notify is implemented four times — S
- Class: a hand-rolled listener set (`Set<() => void>`, `subscribe`, `notify`) per store.
- Sites: `lib/persistedStore.ts:7-18`; `lib/createSelectionStore.ts:17-30`; `sync/syncStatusStore.ts:9-21`; `features/progress-overlay/progressStore.ts:6-16`.
- Rule: CLAUDE.md "check `src/lib` for one that already does the job".
- Evidence: four `new Set<() => void>()` in `src`; each pairs with `useSyncExternalStore`.
- Cost: each new store copies 12 lines; one (`progressStore`) forgot to return the unsubscribe.
- Fix: `lib/createStore<T>(initial)` with `get/set/subscribe`; the four become its callers.
- Check: `rg -n "new Set<\(\) => void>" src` → 1.
- Seen next run: the count.
- Files: five. Size: S. Test: `test/createStore.test.ts` ("a listener stops after unsubscribe").

### F46 · Two axios instances with their own interceptors — S
- Class: the API client is built twice, once for the app and once for the library copy script, with different auth and error handling.
- Sites: `lib/api/client.ts:10-34`; `features/library-copy/copyClient.ts:8-29`.
- Rule: CLAUDE.md "API request, response and record types come from `packages/shared` … on both sides" (the client is where they are used).
- Evidence: `rg -n "axios.create" apps/mobile/src` → 2; the second lacks the 401 → logout interceptor.
- Cost: a copy run on an expired session loops on 401 instead of logging out.
- Fix: `copyClient` takes `apiClient` with a base-URL override.
- Check: the `rg` → 1.
- Seen next run: the count.
- Files: two. Size: S. Test: extend `test/apiClient.test.ts` ("a 401 on any client logs out").

### F47 · Sheet list padding is computed per sheet — S
- Class: each searchable sheet list adds the search bar height and the safe-area inset by hand.
- Sites: `hooks/useSheetSearchList.ts:21` (the helper) vs `features/contacts/ContactPickerSheet.tsx:44`, `features/albums/AlbumPickerSheet.tsx:38`, `features/lists/ListPickerSheet.tsx:40` (their own sums).
- Rule: CLAUDE.md "Components define their appearance; parents define layout".
- Evidence: three sheets sum `SEARCH_BAR_HEIGHT + insets.bottom + spacing.md` where the hook already returns `contentContainerStyle`.
- Cost: the three pickers scroll under the search bar by 8 px on a notch device (ux-parity s4).
- Fix: the three take the hook's style.
- Check: `rg -n "SEARCH_BAR_HEIGHT" src/features` → 0.
- Seen next run: the count.
- Files: three. Size: S. Test: none (visual; the gallery page covers the hook).

### F48 · Descriptor lists are built by hand next to the list they must match — S
- Class: a derived list (the instruction schema's keys, a collection's field groups) typed out beside its source instead of being derived.
- Sites: `packages/shared/src/instructions.ts:18-31` (`z.enum([...])` repeating `INSTRUCTION_KINDS`); `packages/shared/src/collections/define.ts:40-52` checks `fieldGroups` and `finalField` against the schema at runtime, but `packages/shared/src/collections/posts.ts:61-70` and `assets.ts:48-55` restate the key lists.
- Rule: sync-design §9 "Each collection is defined once in `packages/shared/collections/`".
- Evidence: the registry guard (`packages/shared/test/registry.test.ts`) would catch a drift at runtime, in tests only; `z.enum(INSTRUCTION_KINDS)` is one call.
- Cost: a new instruction kind is added in two places (63dc4c3 did).
- Fix: `z.enum(INSTRUCTION_KINDS)`; `fieldGroups` derived with `keysOf(schema.shape)` where define.ts already has the schema.
- Check: C16 (typed registry: `satisfies` on each descriptor makes a missing key a type error) → today the registry is checked at runtime only.
- Seen next run: a typecheck failure replaces the runtime guard.
- Files: four in `packages/shared`. Size: S. Test: the existing registry test stays.

### F49 · `OwnFields` is restated in three places — S
- Class: the "fields a device owns outright" set written per consumer.
- Sites: `packages/shared/src/collections/ownFields.ts:5`; `apps/mobile/src/sync/mergeRecord.ts:21-27`; `apps/server/src/sync/merge.ts:14-19`.
- Rule: sync-design §9 "The descriptor drives Zod validation on push, the inferred TypeScript types on both sides, and the registry (`registry.ts`) that the server's pull, push and migrate iterate" (the own-fields list belongs with it, not beside each merge).
- Evidence: the three lists agree today; `mergeRecord.ts` has the comment "keep in sync with ownFields.ts".
- Cost: a comment is the only guard on the merge rule's input.
- Fix: both merges import `OWN_FIELDS` from shared.
- Check: `rg -n "keep in sync" apps packages` → 0.
- Seen next run: the count.
- Files: two. Size: S. Test: `push.merge.test.ts` already covers the behavior.

### F50 · One-side logic lives in `packages/shared` — S
- Class: a helper only the server or only the app calls, placed in shared.
- Sites: `packages/shared/src/s3Keys.ts` (server only); `packages/shared/src/thumbnailSize.ts` (app only); `packages/shared/src/formatHandle.ts` (app only).
- Rule: CLAUDE.md "a type the server and the app both need … moves into `packages/shared`" (and so: one that only one side needs stays on that side).
- Evidence: knip with `includeEntryExports` lists each with one importer package (counts.md "shared exports with one importer side": 12, of which 9 are types the contract needs on one side, 3 are logic).
- Cost: a change to a server key format ships to every app build and triggers a contract snapshot.
- Fix: move the three to their side.
- Check: C4 (`packages/shared/test/sharedFolders.test.ts`: every non-type export is imported by both `apps/*`) → 12 today, 3 after the type exemption.
- Seen next run: the count.
- Files: three moves. Size: S. Test: C4.

### F51 · The string `place` arm survives after its migration — S
- Class: a read path that still handles a record shape no build writes.
- Sites: `apps/mobile/src/sync/assetsRepository.ts:112-118` (`typeof place === 'string'`); `packages/shared/src/collections/assets.ts:34` (`z.union([placeSchema, z.string()])`).
- Rule: sync-design §15 "Never remove, rename, retype or narrow what an old build sends or reads" and "A behaviour change keeps the old path for old builds, until no device runs them": the arm may go only once no installed build sends a string, which `installedBuilds.e2e.test.ts` and the build snapshots show today; §15 has no sentence saying when such a path is removed (decision 1c).
- Evidence: `apps/mobile/test/.builds/*/contract.json` → no build lists `place: string`.
- Cost: every reader branches on a shape nothing produces; the union hides a typo in the object.
- Fix: drop the string arm from the schema and the repository; `contract.test.ts` confirms no installed build sent it.
- Check: N17 (new rule, decision 1: a `z.union` with `z.string()` in a collection schema needs a `// until build N` comment) → 1 with it.
- Seen next run: the arm gone.
- Files: two. Size: S. Test: `contract.test.ts` extended ("a removed shape no installed build writes passes").

### F52 · Server `as any` at three non-edge sites — S
- Class: a cast that hides a type the code could name.
- Sites: `apps/server/src/routes/catalog.ts:88`; `apps/server/src/sync/pull.ts:141`; `apps/server/src/persona.ts:63`.
- Rule: CLAUDE.md "no `any` except at a third-party edge with a comment".
- Evidence: the mobile lint forbids it; the server eslint config has `no-explicit-any: off`.
- Cost: `pull.ts:141` casts a row to the record type; a column renamed in the schema would not fail there.
- Fix: name the types (drizzle's `InferSelectModel`), and turn the server rule on.
- Check: C8 (server `@typescript-eslint/no-explicit-any: error`) → 3 today.
- Seen next run: the lint at 0.
- Files: three plus the eslint config. Size: S. Test: none (typecheck).

### F53 · `MergePlan` hand lists restate the descriptors — S
- Class: a field-by-field list in the library merge that the collection descriptor already holds.
- Sites: `apps/mobile/src/sync/mergeLibrary.ts:88-104,210-226,331-347,449-461` (four `pick` lists, one per collection merged).
- Rule: sync-design §9 "Each collection is defined once in `packages/shared/collections/`".
- Evidence: each list equals `descriptor.fieldGroups.flat()` minus `id`; the fourth (`:449`) misses `favoritedAt`, the one field the earlier report's favoritedAt count tracks (6 → 5: the miss is this one).
- Cost: a new synced field is merged on pull (descriptor-driven) and dropped by the library merge (hand list) until someone notices.
- Fix: derive the four lists from `collections[name].fieldGroups`.
- Check: `rg -n "pick\(\[" apps/mobile/src/sync/mergeLibrary.ts` → 0.
- Seen next run: the count; the favoritedAt count at 0 hand copies.
- Files: one. Size: S. Test: `test/mergeLibrary.test.ts` extended ("every descriptor field survives a library merge", generated from the registry).

### F54 · The same rows are read twice in one operation, five ways — S
- Class: an operation reads what it already holds.
- Sites: `features/backup/backupRun.ts:30-71` (10 statements per run where 6 suffice: the asset rows are re-read after the file stat); `features/instructions/useInstructions.ts:22` and `clearInstructionsEqualTo.ts:9` (the published text read by the hook and again by the clear); `apps/mobile/src/sync/mergeLibrary.ts:449` (the album rows read per asset instead of once); `features/run-with-files/useRunWithAssetFiles.ts:31,44` (`stat` twice per file); `features/contacts/contact-new/ContactNewScreen.tsx:40-52` (three live watches on one contact).
- Rule: CLAUDE.md "Check performance by counting work (statements, rows read, query plans)"; the efficiency brief's bar: rows re-read per item of a loop.
- Evidence: `test/performance.test.ts` pins the sync counts only; the backup's 10 was counted by hand (efficiency-mobile 3).
- Cost: a backup of 2 000 assets runs 4 000 statements it does not need; the contact screen re-renders three times per edit.
- Fix: pass the rows down; one live watch per screen (`useLiveRecord` once, derive the rest).
- Check: `test/performance.test.ts` extended with the backup run count (pinned at 6 per run, N rows read once).
- Seen next run: the pinned count.
- Files: five. Size: S. Test: the performance test.

### F55 · Per-item work runs serially where it could batch — M
- Class: a loop that commits, uploads or presigns one item at a time.
- Sites: `features/tags/useTagPhotosFromMentions.ts:40-58` (one `saveUserRecord` commit per photo; N transactions); `features/backup/backupRun.ts:80-96` (serial uploads, where `lib/pool.ts` runs 3 wide); `apps/server/src/routes/files.ts:44-62` (one presign call per file; the client calls it per file in `sync/pushPhase.ts:71`).
- Rule: sync-design §6 "pushes are batched; one transaction per batch".
- Evidence: `useTagPhotosFromMentions` with 50 photos → 50 commits, 50 `requestSync()` calls (debounced to one push); the presign route is called 1 000 times for a 1 000-file push.
- Cost: tagging a large selection takes seconds; a cold first push takes minutes on the presign round-trips alone.
- Fix: `saveUserRecords(records[])` in one transaction (the repository already has `withTransaction`); the pool for uploads; a `POST /files/presign` taking `keys[]` (additive, §15) and the client sends batches of 50.
- Check: `test/performance.test.ts` ("tagging N photos is one transaction"); contract test for the new route.
- Seen next run: the counts.
- Files: three mobile, one server route, the contract snapshot. Size: M. Test: as above.

### F56 · `AssetImage` stats the file on every mount — S
- Class: a per-render filesystem call that the record already answers.
- Sites: `components/AssetImage.tsx:38-46` (`FileSystem.getInfoAsync` in an effect on mount; the asset row carries `localPath` and `fileState`).
- Rule: CLAUDE.md "performance and reliability".
- Evidence: a grid of 60 thumbnails → 60 stats per scroll window (efficiency-mobile 5).
- Cost: visible hitch on the first scroll of the library on an older device (ux-parity s3).
- Fix: trust `fileState === 'present'`; stat only on an image load error.
- Check: `rg -n "getInfoAsync" src/components` → 0.
- Seen next run: the count.
- Files: one. Size: S. Test: `test/AssetImage.test.tsx` ("a present asset renders without a stat").

### F57 · The prompt-button seed runs per mount — S
- Class: a derivation of the catalog done per screen mount instead of once per catalog.
- Sites: `features/assistant/usePromptButtons.ts:19-33` (filters and sorts the published buttons on every mount; the catalog changes once per sync).
- Rule: CLAUDE.md "performance".
- Evidence: the tray mounts per post row in the feed; 20 rows → 20 sorts of the same list.
- Fix: derive in the catalog store once (`catalogStore.promptButtons`), the hook selects.
- Check: `rg -n "RETIRED_PROMPT_BUTTONS" src/features` → 1 (the store), not the hook.
- Seen next run: the count.
- Files: two. Size: S. Test: none new (the store's test covers it).

### F58 · The album count query is keyed on the sort order — S
- Class: a live query whose key includes a value it does not use, so it re-runs needlessly.
- Sites: `features/albums/useAlbumCounts.ts:14` (`useLiveQuery(..., [sortOrder])` where the SQL ignores the order).
- Rule: CLAUDE.md "Check performance by counting work".
- Evidence: changing the sort in Settings re-runs the count query (435 ms per `albumQuery.ts`'s comment) with the same result.
- Fix: drop the key.
- Check: none (one site).
- Seen next run: gone.
- Files: one. Size: S. Test: `test/performance.test.ts` ("a sort change runs no count query").

### F59 · Fractional ordering keys are recomputed over the whole list — S
- Class: an O(n) rekey where the fractional-key scheme is there to make a move O(1).
- Sites: `apps/mobile/src/sync/edgesRepository.ts:71-92` (`moveEdge` rewrites every `orderKey` of the parent); `lib/keyBetween.ts` exists for one insert.
- Rule: sync-design §12 "a move (`move`, `movePositions`) keys the moved edge and the edges tied with the one it was dropped after with `keysBetween`, between that one and the next" and "as few edges as possible are written".
- Evidence: `rg -n "keyBetween" src` → 4 sites, none in `moveEdge`; `twoDevice.e2e.test.ts` has no concurrent-move case.
- Cost: a move in a 500-photo album writes 500 edges and 500 LWW clocks; two devices moving at once conflict on every row instead of one.
- Fix: `moveEdge` writes one key with `keyBetween(prev, next)`; rekey only when the key length passes a bound.
- Check: C20 (`rg -n "keysBetween" src/sync` → ≥1 in `edgesRepository.ts`; F59's grep was `keyBetween`, which does not match the doc's name: the builder confirms the count first); `performance.test.ts` ("a move writes one edge").
- Seen next run: the pinned count.
- Files: one. Size: S. Test: the performance test; `twoDevice.e2e.test.ts` ("two devices moving different photos both keep their move").

### F60 · The database has no row-level security on the 16 collection tables — M (decision 4)
- Class: tenancy enforced in every query's `where userId = …` and nowhere else.
- Sites: every repository under `apps/server/src/sync/` (F7's four clauses are the visible part); `apps/server/drizzle/*.sql` → `rg -c "CREATE POLICY"` → 0.
- Rule: CLAUDE.md "data integrity" second; sync-design §3 "a user never sees another user's rows".
- Evidence: one missed clause (R7's shape) leaks rows; the earlier report's decision 7 asked and was not answered.
- Cost: every new route carries the whole burden; a review can miss one.
- Fix: `ENABLE ROW LEVEL SECURITY` + a policy on `user_id = current_setting('app.user_id')` per collection table; the request sets the setting in `authenticate.ts`.
- Check: `apps/server/test/rls.test.ts` ("a query without the setting returns no rows") and the drizzle migration.
- Seen next run: `CREATE POLICY` count = 16.
- Files: one migration, `authenticate.ts`, `db.ts`. Size: M. Test: as above.

### F61 · The sync fuzz has no crash fault and no edge or contact operations — M (decision 4)
- Class: the generator's operation set is narrower than the operations the app makes.
- Sites: `apps/mobile/test/sync.fuzz.test.ts:40-88` (ops: create/update/delete on assets, albums, posts; faults: network); no `crash` mid-transaction; no `edges`, `contacts`, `memberships`.
- Rule: sync-design §13 "the fuzz covers every collection and every fault the client handles".
- Evidence: R1 (restore revives edges) and the earlier F4 (contact cascade) both lived in collections the fuzz does not touch.
- Cost: the two data risks of this run were in the blind spot.
- Fix: add the three collections and a `crash` fault (kill between the write and `requestSync`); seed-pinned.
- Check: the test's op list is read by `test/fuzzCoverage.test.ts` ("every collection in the registry has an op").
- Seen next run: the coverage test.
- Files: two tests. Size: M. Test: as above.

### F62 · Comments restate the code or promise a later change — S
- Class: a comment that says what the next line says, or "TODO later" where `todo.md` is the list.
- Sites: 31 restating comments (counts.md "comments restating the line": 31; `rg -n "// (set|get|return|call) " src` finds 19 of them); 6 "later"/"for now" promises (`rg -n "for now|later\b" apps/mobile/src apps/server/src --glob '*.ts*' -i` → 6).
- Rule: CLAUDE.md "`todo.md` is the single list of open work".
- Evidence: `features/backup/backupRun.ts:12` "// for now serial"; `sync/pull.ts:30` "// TODO batch later" (both are F54/F55 sites with no todo entry).
- Cost: the promise is the only record; it is found by review, not by the list.
- Fix: delete the restating lines; each promise becomes a `todo.md` entry the owner accepts (proposed in decision 2) or is deleted.
- Check: `rg -n "TODO|FIXME|for now" src` → 0 (eslint `no-warning-comments` on the mobile and server configs).
- Seen next run: the lint at 0.
- Files: ~30 one-line deletions. Size: S. Test: none.

### F63 · Runtime guards check what the types already guarantee — S
- Class: an `if (!x) throw` or `switch` default on a value whose type excludes the case.
- Sites: `components/Button.tsx:58-61` (guards `size` against the union); `components/Icon.tsx:33` (guards a name from the typed table); `features/thumbnails/createThumbnail.ts:19` (`if (!asset.id)` on a required field); `apps/server/src/chatVerify.ts:88-96` (asserts the shape zod already parsed); `packages/shared/src/mediaTypes.ts:12` (`MEDIA_TYPES.includes` on a typed literal).
- Rule: CLAUDE.md "Don't test … what the types already guarantee" (tests; the same bar for code).
- Evidence: `npm run typecheck` is strict; none of the five branches is reachable.
- Cost: a reader assumes the case can happen and keeps the guard alive downstream.
- Fix: delete the five.
- Check: none (judgement).
- Seen next run: the simplification scanners find none.
- Files: five. Size: S. Test: none.

### F64 · Copy within one file — S
- Class: the same lines twice in one file.
- Sites: `components/StatusCard.tsx:40-55,70-85` (two branches building the same row); `components/Chip.tsx:48-66,72-90` (the pressable wrapper twice, once per `raised`); `apps/mobile/src/sync/worker.ts:140-152,180-192` (`pushTo` for the two phases); `apps/server/src/config.ts:18-31` (`optionalString` spelled per key).
- Rule: CLAUDE.md "Small private helpers may live in the same file".
- Evidence: the four pairs diff in one token each.
- Fix: one private helper per file.
- Check: none (jscpd within a file; not worth a tool).
- Seen next run: the reuse scanners find none.
- Files: four. Size: S. Test: none.

### F65 · Derived state is stored — S
- Class: a `useState` whose value is a function of other state.
- Sites: `app/_layout.tsx:61` (`appIsReady` = fonts && library && session; three setters); `components/SortableGrid.tsx:93,104` (`emptyRightMeasure`, an empty-styles object held in state).
- Rule: CLAUDE.md "ordered hooks → derived values → handlers": derived values are computed, not stored.
- Evidence: `appIsReady` is set in three effects; one order of resolution leaves it false for a frame (the splash flashes, ux-parity s1).
- Fix: `const appIsReady = fontsLoaded && libraryReady && sessionKnown`.
- Check: none.
- Seen next run: gone.
- Files: two. Size: S. Test: `test/routes.test.ts` extended ("the root stack renders once every gate has resolved").

## 4. Checks

Every machine-spottable class above has a check. A check whose rule CLAUDE.md or a design doc already states is ready to build on its own (one S build request each). A check whose rule is new attaches to the decision that states the rule; it is built only when that decision is taken.

### Ready to build (the rule is stated)

| Id | Check | Rule (quoted) | Hits today | Classes |
|----|-------|---------------|-----------|---------|
| C1 | eslint `no-restricted-syntax` on `BinaryExpression[operator='instanceof'][right.name='Error']` outside `lib/errorMessage.ts` / `apps/server/src/errorMessage.ts`; mobile and server | CLAUDE.md "check `src/lib` for one that already does the job" | 12 mobile + 4 server | F29 |
| C2 | eslint `no-restricted-imports` on `react-native`'s `Text`, `Modal` in `src/features/**` and `src/app/**`; `no-restricted-syntax` on `listTextStyles` outside `components/`; ratchet file for the `Text` sites until 0 | CLAUDE.md "Don't … use low-level primitives (raw `TextInput`, menu primitives) in features when a project component exists" | `Text` 21, `Modal` 1, `listTextStyles` 18 | F10 |
| C4 | `packages/shared/test/sharedFolders.test.ts`: every non-type export of `packages/shared` is imported from both `apps/mobile` and `apps/server` | CLAUDE.md "a type the server and the app both need … moves into `packages/shared`" | 12 (3 after exempting types) | F8, F50 |
| C5 | `rg` script in `npm run check`: every `saveUserRecord`/`deleteUserRecord`/`writeEdge` caller outside `sync/` is followed by `requestSync()` in the same function, or carries `// no sync:` | sync-design §8 Triggers: "After each local write (`requestSync()` from the providers)." | 16 callers, 4 without, 3 with a comment | F27 |
| C6 | `test/deleteConfirms.test.ts`: every `Alert.alert` whose first button is destructive goes through `useConfirmedDelete` | CLAUDE.md "Build screens from the components in `src/components`" | 7 | F11 |
| C7 | knip `includeEntryExports: true`, `ignoreExportsUsedInFile: false`, plus `ignoreDependencies` cleared | CLAUDE.md "Delete code that is merely unused" | 7 unused exports + 16 exports used only in-file + 17 unused types + 14 unlisted deps | F36 |
| C8 | server eslint `@typescript-eslint/no-explicit-any: error` (the mobile config has it) | CLAUDE.md "no `any` except at a third-party edge with a comment" | 3 | F52 |
| C10 | `test/routes.test.ts` extended: every route under a sheet group has its copy in each group it is opened from, generated from `app/` | CLAUDE.md "A screen that also opens inside a sheet has a copy in that sheet's group" | 17 singular lines | F20 |
| C11 | `test/routes.test.ts`: every picker route is `presentation: 'modal'` | CLAUDE.md "Open a sheet … for … picking something" | 6 | F17 |
| C13 | Playwright `ui-flows`: fail on the "cannot contain a nested" console error | none stated: the browser's own error ("cannot contain a nested" button); a regression test on the `ui-flows` log, not a rule check | 2 (s2.log) | F18 |
| C16 | typed registry: each descriptor `satisfies CollectionDescriptor<Schema>` so `fieldGroups` keys are checked at typecheck | sync-design §9 "Each collection is defined once in `packages/shared/collections/`" | runtime only today | F2, F48, F53 |
| C17 | `test/performance.test.ts` extended with the backup, tagging and move counts | CLAUDE.md "Check performance by counting work" | not pinned | F54, F55, F59 |
| C20 | `rg -n "keysBetween" src/sync` ≥ 1 in `edgesRepository.ts`, in `check` | sync-design §12 "a move (`move`, `movePositions`) keys the moved edge and the edges tied with the one it was dropped after with `keysBetween`, between that one and the next" | 0 for `keyBetween` in `edgesRepository.ts` (F59's grep; the doc names `keysBetween`, which that grep does not match: the builder confirms the count first) | F59 |
| C22 | eslint `no-warning-comments` (`TODO`, `FIXME`, `for now`) | CLAUDE.md "`todo.md` is the single list of open work" | 6 | F62 |

### Attached to a decision (the rule is new)

| Id | Check | Decision | Hits today | Classes |
|----|-------|----------|-----------|---------|
| N1 | `test/featureImports.test.ts`: a feature imports another feature only through its `index.ts`; ratchet of the cross-feature line count | D2 | 168 lines, 8 cycles | F5 |
| N2 | eslint `no-restricted-imports` on `@/features/*` from `components/`, `hooks/`, `lib/`, `providers/` | D2 | 24 | F4 |
| N3 | eslint `no-restricted-imports` on `@/lib/*` for the names moved to `utils/`, and on `@/constants` | D2 | 45 + 25 | F9 |
| N4 | eslint `no-restricted-syntax` on `router.push(\`…\`)` with a template literal (typed routes only) | D2 | 26 | F21 |
| N5 | eslint rule in `test/` and `e2e/`: `getByText(...).first()` forbidden | D2 | 1 | F31 |
| N6 | `test/uiText.test.ts`: screen titles, section labels and button labels are sentence case | D3 | 13 | F12 |
| N7 | `test/uiText.test.ts`: alert titles start with "Couldn't" or name the item; no success alerts | D3 | 12 (9 on the run-1 selector) | F13 |
| N8 | `test/uiText.test.ts`: `title: 'Delete` appears only inside `useConfirmedDelete` | D3 | 7 | F11 |
| N9 | `rg` in `check`: "Retry" → 0 (the word is "Try again"); "ago'" outside `lib/relativeTime.ts` → 0 | D3 | 3 + 2 files | F14, F15 |
| N10 | GitHub branch protection on `main` requiring `check` and `ui-flows` | D4 | 404 (no protection) | R10 |
| N11 | drizzle migration with `CREATE POLICY` per collection table + `apps/server/test/rls.test.ts` | D4 | 0 policies | F60 |
| N12 | `test/fuzzCoverage.test.ts`: every registry collection and every client-handled fault has a fuzz op | D4 | no `crash` op, 3 collections missing | F61 |
| N13 | eslint `no-restricted-imports` on `expo-clipboard` outside `hooks/useCopyText.ts` | D2 | 1 | F43 |
| N14 | eslint `no-restricted-syntax` on `Identifier[name='SCREEN_PADDING']` outside `styles/` | D2 | 31 | F9 |
| N15 | `test/galleryCoverage.test.ts`: every export of `src/components` has a gallery entry | D3 | 40 missing | F19 |
| N16 | eslint rule: a `*.web.tsx` must `satisfies typeof import('./X')` its native pair | D2 | 13 pairs, 0 typed | F35 |
| N17 | eslint `no-restricted-syntax`: `z.union` with `z.string()` in `packages/shared/src/collections/**` needs `// until build N` | D1 | 1 (F51) | F51 |
| N18 | eslint `no-empty` + `no-restricted-syntax` on `CatchClause[param=null]` without a comment line | D4 | 1 bare, 9 with comment | F34 |
| N19 | `packages/shared/test/instructions.test.ts`: every published text with `{thread}` renders the placeholder table | D1 | 0 failures today | F30 |
| N20 | eslint `no-restricted-syntax` on template literals ending in `s\`` with a count expression, outside `lib/pluralizeText.ts` | D3 | 5 | F15 |

## 5. Decisions

Four, in plain words. Each folds the earlier report's eight unanswered decisions (1 → D1; 2, 3, 4, 8 → D2; 5, 6 → D3; 7 → D4). Nothing below changes code on its own: a yes becomes a build request.

### D1 · What delete and restore mean for the data (R1, R3, R4, F33)

The sync design says what a write does, but three cases are not written down and the code answers each differently.

- **1a. Restoring a contact.** A delete tombstones the contact's list memberships and photo links along with it, and Restore in the Deleted list clears only the contact's own tombstone: the contact comes back stripped of every list and photo tag, on every device, with no way back but re-tagging (R1). §7 states the rule for assets only ("Deleting or purging an asset does not touch its edges, so a restore puts it back where it was"); §10 records the contact rule as open. The earlier report's decision 1 asked this and was not answered; `test/contactsRepository.test.ts:57-67` still pins it with `it.fails`. **Recommendation:** restore puts the contact back where it was, as for assets: `remove` tombstones the edges at the contact's own `deletedAt` clock and `restore` revives exactly the edges whose `deletedAt` equals it, in one transaction; one sentence in §10, the test loses its `it.fails`.
- **1b. Deleting a contact whose photo is missing on this device.** §6 makes a `delete` row upload its files before the push, and the worker never nulls a file field on its own, so when the photo file is gone from this device the tombstone waits forever and the failure row has no `href` to act on: the contact is in Deleted here and live on every other device (R4). Two options, as R4 lists them: the tombstone pushes with the missing file field null (only on a `delete` row), and §6's "never nulls a file field" sentence names the tombstone exception; or the failure row of a `delete` links to the deleted contact and Remove photo works there. **Recommendation:** the first; a tombstone needs no file.
- **1c. Retired defaults.** When a published prompt button is retired, the app keeps a `RETIRED_PROMPT_BUTTONS` list so old builds hide it (F33). §15 does not say this is how a default is retired. **Recommendation:** add the sentence ("a retired default stays in the catalog with `retiredAt`; builds hide it by that field"), and the list goes in the next build after every installed build reads `retiredAt`.
- **Note (R3):** on insert the server gives every unnamed clocked field the inserted record's clock, so an earlier edit of that field from another device loses to a default (R3). The fix in §2 is the code: an unnamed clocked field takes clock 0 (never edited), not `updatedAt`, so any real edit beats the default; a named field keeps `updatedAt`. Its sentence in §6 ("a new record is always written whole, whatever its `fields` name" gains: the clocks are per field, an unnamed field's is 0) is part of this decision so §6, §7 and the code agree.

### D2 · Where things live (F2, F4, F5, F9, F21, F23, F31, F36, F62; earlier 2, 3, 4, 8)

CLAUDE.md names what goes in `features/` and when code moves to `components/`, `hooks/`, `lib/`, and says nothing about the rest; the cold-agent logs show where that costs time (three agents, 14 wrong turns, every one at a folder CLAUDE.md does not name).

- **2a. Features import each other through one door.** 168 cross-feature import lines and 8 cycles (F5). **Recommendation:** a feature's `index.ts` is its only public face; N1 ratchets the count down; the 8 cycles are broken first (one M build).
- **2b. Providers and upward imports.** `components/`, `hooks/` and `lib/` import from `@/features` 24 times (F4), mostly for a provider. **Recommendation:** `src/providers/` for app-wide providers; N2 forbids the upward import.
- **2c. `lib/` vs `utils/` vs `constants/`.** Three folders hold the same kind of thing (F9). **Recommendation:** one folder, `lib/`; `constants/` dissolves into the token files; `SCREEN_PADDING` becomes a token (N14); N3 keeps them from coming back. Add to CLAUDE.md the sentences the cold agents needed: "delete cascades live in `sync/<collection>Repository`"; "ordered membership goes through `edgesRepository` and `assetSql`"; "a synced setting is a one-record-per-user collection, copied from `idea_settings`"; "the per-build copies under `test/.builds/` are snapshots, not code to edit"; "one function first, the second caller is a call, not a copy".
- **2d. Routes by name.** 26 `router.push` with a hand-built string (F21). **Recommendation:** Expo typed routes on; N4 forbids the template literal.
- **2e. The §9 checklist.** Adding a collection touches 11 places (F2). **Recommendation:** §9 lists them in order, and C16 makes the registry typed so a missed one fails typecheck.
- **2f. Tests locate by role.** `getByText().first()` (F31) papers over a duplicate label. **Recommendation:** the sentence in CLAUDE.md's Tests section; N5.
- **2g. The six "for now" comments (F62)** become `todo.md` entries only if the owner says yes to each: serial backup uploads (F55), per-file presign (F55), the string `place` arm (F51), the three others named in F62. Otherwise they are deleted.

### D3 · One voice in the UI (F11–F16; earlier 5, 6)

The app's text follows several conventions at once; none is written down beyond "one name per feature".

- **3a. Sentence case** for titles, section labels and buttons (13 Title Case today, F12). **Recommendation:** yes; N6.
- **3b. Alerts.** Errors start with "Couldn't …" and say what to do; no success alerts (12 sites, F13). **Recommendation:** yes; N7.
- **3c. One delete confirm** (`useConfirmedDelete`, 7 hand-written, F11), and the two screens that delete without asking (R5) go through it. **Recommendation:** yes; C6, N8.
- **3d. One word per action:** "Try again" never "Retry"; "Add a X" for empty states; bare verbs on buttons (F14, F16). **Recommendation:** yes; N9.
- **3e. Relative time** in one place with one wording (F15). **Recommendation:** `lib/relativeTime.ts` using moment's words ("3 minutes ago", "yesterday"), and the plural helper (N20).
- **3f. Collection headers** (earlier decision 6): the page title is the collection's name, the count in the subtitle. **Recommendation:** yes, and `ScreenSectionHeader` gets a `count` prop so the eight screens stop formatting it.
- **3g. A second sheet never opens over a sheet** (F17; CLAUDE.md states it). The six picker routes become pushes inside the sheet; C11 covers it. No decision needed; listed so the owner sees the cost (6 screens, M).

### D4 · Safety nets (R10, F60, F61; earlier 7)

Three nets the process assumed and does not have.

- **4a. Branch protection.** PRs merged while CI was queued (R10); `main` has no protection (404). **Recommendation:** require `check` and `ui-flows`; N10. Zero code.
- **4b. Row-level security** on the 16 collection tables (F60). **Recommendation:** yes; one migration, the request sets `app.user_id`; N11. The earlier decision 7 asked and was not answered.
- **4c. The fuzz covers what the app does** (F61): a crash fault and the three collections missing. **Recommendation:** yes; N12. Both data risks of this run were in the blind spot.

## 6. Outcomes against the earlier report (2026-11-12, run 1)

### Counts

| Count | Run 1 | Today | Direction |
|-------|-------|-------|-----------|
| deep cross-feature import lines (homes F7 measure) | 103 (66 pairs) | 168 (78 pairs) | worse (f02b1ff and 63dc4c3 added `post-ideas → post-chat` 17 and `contact-new → contact-detail` +5) |
| all feature → feature import lines (`counts.md`) | 235 (101 pairs) | 274 (111 pairs) | worse |
| upward imports into `features/` | 24 | 24 | same |
| `features/*` queries imported by other features | 45 | 50 | worse |
| hand-kept defaults per field (`favoritedAt: null`) | 6 | 5 | better (one site merged; F53 names the one that drifted) |
| raw `Text` in features | 33 in 23 files | 33 in 21 files | same |
| raw `Pressable` in features | 21 in 19 files | 19 in 17 files | better |
| raw `Modal` in features | 1 | 1 | same |
| Title Case labels | 14 | 13 | same (one label reworded in f02b1ff) |
| alert titles outside "Couldn't …" | 7 | 12 | same (today's selector also matches "API …" ×3; on run 1's selector 9, and the two extra are run-1 sites the selector missed, no new site) |
| delete confirm shapes | 7 | 7 | same |
| `components/` widgets missing from the gallery | 26 of 56 | 40 of 72 | worse (4 of the 16 new components have no entry: `AssistantTray`, `StatusCard`, `SeesLine`, `ThinkingCard`) |
| `dangerouslySingular` lines in `app/` | 17 | 17 | same |
| `.web` files without `satisfies typeof import` | 13 of 13 | 13 of 13 | same |
| style spreads in features/app | 0 | 0 | same (lint holds) |
| hex literals outside designTokens | 0 | 0 | same (lint holds) |
| files over 300 lines | 14 | 16 | worse (`AssistantTray.tsx` 316, `PostChatScreen.tsx` 311 new; `ComponentGalleryScreen.tsx` 466 → 514) |
| total files | 843 | 897 | +54 |
| preview console errors on the tabs | nested button (every contact list), useMemo size (photo) | nested button (contact detail, repost card) | same class, moved (`s2.log`); useMemo size gone |
| catch sites | 139 mobile + 32 server | 143 mobile + 32 server | same (+4 in `post-chat`, `library`) |

### Fixed findings, still protected?

| Run-1 finding | Fix | Protected today |
|---------------|-----|-----------------|
| R2 (worker dropped a file field) | `workerFileFields.test.ts:199` | yes, the test runs in `check` |
| F4 (contact delete left orphan links) | `contactsRepository.test.ts` cascade case | yes |
| style spreads, hex literals (lints) | eslint rules | yes, 0 hits |
| migrations manifest drift | `migrationsManifest.test.ts` | yes |
| F6 (`changed size` log noise) | removed | yes, no log contains the line |

### Classes

| Run-1 class | Today |
|-------------|-------|
| F1 defaults and samples ×4 | same (F1; 5 → F53 names the drift) |
| F2 collection registry hand wiring | worse (F2: 11 places, 63dc4c3 added `idea_settings` and touched all 11) |
| F3 queries in two homes | same (F3 and F23) |
| F4 contact cascade | gone |
| F5 cross-feature imports | same, site moved (F5; 168) |
| F6 log noise | gone |
| F7 per-user read ×4 | same (F6 client, F7 server; R5 adds two screens) |
| F8 Title Case / alert titles | same (F12, F13 → D3) |
| F9 delete confirm shapes | same (F11) |
| F10 raw primitives | same (F10) |
| F11 gallery coverage | worse (F19: 40) |
| F12 `dangerouslySingular` | same (F20) |
| F13 relative time | same (F15) |
| F14 `.web` pairs | same (F35) |
| F15 one-importer shared files | same (F8, F50) |
| F16 edges stamped with `Date.now()` | same, not re-raised (dropped.md; `membershipRepository.ts:61` unchanged) |
| F17 second sheet over a sheet | same (F17 → D3g) |
| F18 nested buttons | same, moved (F18) |
| R1 restore revives edges | OPEN (`it.fails` still pins it; D1a) |
| R2 worker file fields | fixed |

## 7. Counts for the next run

`counts.md` records numbers without commands; the commands below are the ones SKILL.md step 2 describes, run from `apps/mobile/src` unless noted.

| Count | Command | Today |
|-------|---------|-------|
| deep cross-feature import lines | homes scanner F7 measure (imports past a feature's `index.ts`) | 168 (78 pairs) |
| all feature → feature import lines | `counts.md` import matrix | 274 (111 pairs) |
| upward imports into `features/` | `grep -rn "@/features/" components hooks utils sync library \| wc -l` | 24 |
| `features/*` queries imported by other features | `grep -rl "features/.*Query'" features \| wc -l` | 50 |
| hand-kept defaults per field | `grep -rn "favoritedAt: null" apps packages --include=*.ts \| grep -v drizzle \| wc -l` (repo root) | 5 |
| raw `Text` in features | `grep -rn "<Text\b" features app \| wc -l` | 33 (21 files) |
| raw `Pressable` in features | `grep -rn "<Pressable" features \| wc -l` | 19 (17 files) |
| raw `Modal` in features | `grep -rn "<Modal" features \| wc -l` | 1 |
| `listTextStyles` outside `components/` | `grep -rn listTextStyles features app \| wc -l` | 18 |
| Title Case labels | N6 selector | 13 |
| alert titles outside "Couldn't …" | N7 selector (today's) | 12 |
| delete confirm shapes | `grep -rn "title: 'Delete" features \| wc -l` | 7 |
| `components/` widgets missing from the gallery | C12 | 40 of 72 |
| `dangerouslySingular` lines in `app/` | `grep -rn dangerouslySingular app \| wc -l` | 17 |
| `.web` files without `satisfies typeof import` | C14 | 13 of 13 |
| `instanceof Error` outside the helper | C1 | 11 + 4 server |
| writes without `requestSync()` | C5 | 4 of 16 |
| `SCREEN_PADDING` sites | C9 | 31 |
| hand-built `router.push` strings | N4 | 26 |
| `expo-clipboard` outside the hook | C3 | 1 |
| `new Set<() => void>` stores | F45 | 4 |
| `axios.create` | F46 | 2 |
| `keyBetween` in `sync/` | C20 | 0 in `edgesRepository.ts` |
| `CREATE POLICY` in migrations | N11 (repo root, `apps/server/drizzle`) | 0 |
| server `as any` | C8 | 3 |
| "for now" / TODO comments | C22 | 6 |
| shared exports with one importer side | C4 | 12 (3 logic) |
| knip: unused exports / in-file-only / unused types / unlisted deps | C7 | 7 / 16 / 17 / 14 |
| style spreads, hex literals | lint | 0, 0 |
| files over 300 lines | `counts.md` | 16 |
| total files | `counts.md` | 897 |
| preview console errors on the tabs | `ux-scripts/s*.log` ("cannot contain a nested") | s2: 1; s1, s3, s5, s6: 0 |
| cold agent: files read / wrong turns | `findings/task-*.md` | 13/0, 13/7, 21/7 |

## 8. Not findings (copy of `dropped.md`)

One line each: what, and the criterion it fails.

- `resolveStorage(user, loadConfig().S3_SHARED_BUCKET)` at three server sites (reuse-server 6): no cost; the bucket parameter keeps the resolver pure for its test (simplification-server found it below the bar).
- `useBreath` and `useShineProgress` as two findings (homes F7 / what-went-wrong 6 vs simplification-ui-shared 7): one site set; kept once under F8 with the merge into `useLoop` as the fix.
- The persona row read twice per assistant request (efficiency-server 2): one site set with reuse-server 1 / simplification-server 4; kept once under F7.
- `error instanceof Error ? …` as four findings (reuse-features 1, reuse-ui-shared 1, reuse-sync 5, simplification-sync 6, reuse-server 4, simplification-server 5): one class; kept once under F29.
- Writes without `requestSync()` (data-integrity F6) and "write then requestSync" spelled per method (reuse-features 2): one rule; kept once under F27.
- Earlier F16 (new edges stamped with `Date.now()`, not the clock): no scanner re-raised it this run and the earlier report found no loss; `membershipRepository.ts:61` is unchanged (reuse-sync 6 names the line for another reason, F24).
- Instruction kinds as columns and `idea_settings` as one record per user with two columns per kind (what-went-wrong, not findings): a choice §10 made on purpose.
- `RETIRED_PROMPT_BUTTONS` as boot code against §15 "not boot code to delete later": a choice the repo made in 63dc4c3 and keeps; only the missing §15 sentence is kept (F33, decision 1c).
- The thread placeholder appended to published texts without `{thread}`: §15's additive rule, by design.
- `withPlaceholder`/`userTurnText`, `readMentions` and `useTitleReveal` as sites (what-went-wrong 1): already merged by their fix-ups; the pattern is in question 1 and its sentence in decision 2.
- The three schemas per collection and the two registries (homes, reuse-shared): sync-design §9 wants them by hand per dialect; the registry guard covers drift.
- Route copies under `(main,new-post,compare)` and `(editor,new-post,compare)`: CLAUDE.md names the convention and `routes.test.ts` covers which copy opens (only the singular lines are F20).
- `app/_layout.tsx` at 297 lines with `LibraryGate`, `AppGate`, `RootStack`: §8 names them there; the sheets are declared once.
- `any` at 17 mobile `sync/` drizzle edges with a disable comment: enforced already by the mobile lint.
- Style spreads and hex literals in features: enforced already (the two lints of run 1 at 0).
- `Alert.prompt` for a new album and a new list: CLAUDE.md allows one line of text in an alert prompt.
- `Pressable` as the root of a row (`ContactRow`, `AlbumListItem`, `ContactPhotosStrip`): a row is a legitimate pressable; counted under F10 only where it wraps a `Card` or nests a button (F18).
- Motion: every `withTiming`/`withSpring` outside `motion.*` in features and the #98 components has its reason in the file (ux-parity).
- `getPickedAssetMetadataAsync`'s sibling catch in `createAssetThumbnail.ts:25-28`, `persistedStore.ts:39`, `logoutAsync.ts:11`, the sweeps' swallowed removal errors: each a documented §7a/§8 choice.
- `pushPhase` reading rows before the uploads; `filesToUpload` after a `skipped-lww` adoption; the device library's singleton records; the dev library copy reading another user's rows: covered by tests or by design (data-integrity, not findings).
- `sync/pushPlan.ts` three booleans with a history comment: §6 names `planPushOutcome`; its pure test is the point.
- `pendingPurge` (SQL) vs `purgeWaits` (JS), `unsynced` (SQL) vs `isUnsynced` (JS): one rule in two languages that cannot share a form; each comment points at the other.
- `useModelKindParam()` / `useAvailableUserId()` gate wrappers in 12 screens: forced by the rules of hooks; one line each.
- The ten `useX = () => useRequiredContext(XContext)` one-liners: CLAUDE.md's one-export-per-file makes the split deliberate.
- `catalog.ts` 5-minute cache with per-request marks, `purgedFiles.ts` holding the lock across S3, the double `isPurgedFileKey` check, `persona.ts` seeded random sample, `authenticate.ts` user load per request: each decided in §7a/§5 or its own comment (efficiency-server, not findings).
- `status.ts` read-before-write on `sync_meta` (14 statements per idle run): below the cost bar; `performance.test.ts` pins the writes.
- `chatContextReader.ts:30-39` reading the chat's assets twice per turn: on purpose (rows can change during the tagging wait).
- `albumQuery.ts` correlated subqueries: the comment records the measured alternative (435 ms per album); a decision.
- `AssistantTray` against CLAUDE.md's sparkle/tray sentence: matches (lead chip first, raised prompt chips, Chat in the header).
- `MOCK_PERSONA`, `withTimeout`, `errors`, `users` at the server root: one home each, several callers.
- `lib/lucide.ts` with one importer: `Icon`'s bundling table, kept on purpose (its comment).
- `shuffle`, `formatDateTime`, `formatFullDateTime` with one caller: generic; inlining is not smaller.
- The flat `apps/mobile/test/` (157 files) and `apps/server/test/` (40): one home each.
- `apps/mobile/test/.builds/*`: per-build copies the contract machinery pins, not drift (a note for cold agents is in decision 2c).
- `SettingsScreen.handleResortAlbums` resembling `useConfirmedRun`: needs the blocking overlay; a developer tool with one site.
- `CatalogStatus title="Couldn't load …"` ×3 ×2 and `pluralizeText('1 contact', …)` ×5: strings, no logic.
- `JSON.stringify(a) !== JSON.stringify(b)` dirty checks ×3: `changedValues` is a per-field diff, not equality; a `deepEqual` for three one-liners is not smaller.
- `ThinkingCard` vs `ReplyError` four-line style: kept once under F70 (the status card copy), not as a second finding.
- `apiAiModelSchema.isUncensored` derivable from two fields: installed builds read it; §15 forbids removing a response field.
- `handleSchemas`/`contactReadSchema` built with `Object.fromEntries` and a cast; `MODEL_LABEL_KEYS`; the `recordOf` idea over eight casts: each site's value type differs; a helper would not be smaller.
- `index.ts` exporting `z`; `testing/` helpers; `lostFields.ts` as its own file: one export per file, used on both sides.
- `imagePickerMediaTypeToAssetMediaType`'s `default: throw`: the picker's type may hold other values; not a type-guaranteed branch.
- `ProgressOverlayHost`'s four-side zero instead of `absoluteFill`; `afterDelete?.()` vs `if (afterDelete)`; `readByIds` deduping twice: below the cost bar.
- `SortableGrid`'s own `scrollY` beside the screens' `useScrollY`: the grid's is for its gestures and window; composing them is what `useComposedEventHandler` is for.
- `Button`'s three size-style lookup tables, `designTokens.ts` at 397 lines, the octopus worklet math: single-purpose, each token used.
- The orange focus ring on web text fields and the Expo dev-menu toast: the browser's and the dev client's, not the app's.
- #97, #100, #101: one commit each, no copy, no fix-up (what-went-wrong, not findings); #99's `useScrollY` wiring per tab screen and `nameEnd` in Album: each screen's own.
- 63dc4c3's hook-order and one-name fixes, f02b1ff's design iteration after the owner saw the tray: review judgement and design feedback, not structure.
- Keyboard handling of `AssetNote` in the details panel: not verifiable on web; not confirmed, not filed.
