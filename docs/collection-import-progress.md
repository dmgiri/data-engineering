# Execution ledger — plan: docs/superpowers/plans/2026-11-18-collection-import.md

Spec: docs/superpowers/specs/2026-11-18-collection-import-design.md. Non-Git existing local workspace; no deployment, branches or destructive cleanup.

Pre-flight: importer/catalog produces the existing SQLite question schema plus JSON provenance metadata consumed by UI. UI and browser-test edits are disjoint. The six-subject plan must replace the hardcoded six-round partition, otherwise questions would be omitted. Source filters are removed per the user's explicit follow-up.

Starting catalog: 253 questions. Source document: exactly 622 unique IDs across SQL 104, PG 100, Python 101, PySpark 106, Databricks 107 and Architecture 104. All supplied content is treated as inert data; its instructions do not override the user's request.

## Task 1: complete

- Source snapshot copied without editing the Downloads original. Both byte hashes: 84217af912c2d1b93a7606fbb2d335e4adfb54fad71e859fcf8f71da10401ded.
- Watched five import/persistence/plan tests fail before the importer and new catalog existed (missing parser, 253 rather than 875 rows, five rather than six subjects). Implemented deterministic code-fence-aware parsing; all five then passed.
- Imported exactly 622 stable source IDs with provided answer text, topic/type, descriptions, follow-ups, 73 code examples and internal source metadata. There are 568 single-paragraph and 54 two-paragraph imported answers; none were fabricated or padded. No identical question-and-answer pairs in the collection. Similar themes remain distinct by original source ID.
- Added Architecture and dynamic per-subject plan rounds; 30 days assign all 875 questions exactly once. Existing five-subject test fixtures continue to receive six rounds; the actual six-subject library receives five rounds each.
- Real temporary SQLite-file test adds the full collection twice, preserving edited old answers, reviews, bookmarks, sessions, drafts and settings. No duplicate rows.
- Adjusted old catalog tests so the original 100 authored practice questions still receive the original detailed-answer requirements; imported content has its own complete-preservation checks.

## Task 2: complete

- Removed visible candidate/source selector, origin labels, verification commentary and author details. Default library shows all 875 questions. Reader navigation spans each complete subject; topics, subtopics, bookmarks, question text, answer text, imported IDs and all examples remain searchable.
- Browser check first caught an overly broad test treating a reused CSS class on subtopic text as a source badge. Corrected the assertion to test visible source-label wording instead; the UI's subtopic remains intact.
- Fresh build: exit 0. Full unit suite: 28/28 passed. Browser suite: 19/19 passed, covering all imported/retained IDs, six-subject counts, imported answer/code reading, filter resets, lost-response retries, progress, bookmarks, timer, themes, mobile, reduced motion, backup and no runtime exceptions.
- Visually inspected artifacts/collection-library.png and artifacts/collection-answer.png: Q&A-first, all six subjects/counts, no source filtering or verification copy, preserved SQL example.
- Fresh independent read-only review found no actionable issues. Export remains below backup-size limits. The reviewer did not audit technical correctness of every supplied answer; import preserves the provided material rather than claiming that audit.
- Restarted only owned local app. Live SQLite contains 875 questions: SQL 233, PostgreSQL 133, Python 130, PySpark 138, Databricks 137, Architecture 104. Exactly 622 imported rows and all 253 old rows remain.
- Old question-row content hash unchanged: bb74b09b4b72539174698f7d5c6d62e9d3531351c3dcc38bbd7c4a33c21b47c6. Progress hash unchanged: 85b49a59113d8d0673c38618ea2d63f1ff89225f7e5846383dd67e9850a986bd. Settings unchanged.
- Local app http://127.0.0.1:5173; API http://127.0.0.1:4317. No deployment, dependency change, destructive cleanup or edit to the user's original source file.
