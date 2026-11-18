# SDD ledger — plan: docs/superpowers/plans/2026-11-18-linkedin-library.md

Pre-flight: Task 1 supplies nullable provenance and subtopic fields; Task 2 consumes these and treats absent provenance as retained practice. Interfaces agree. No repository/branch helpers apply in this existing non-Git checkout.

Task 1: complete — 45 source-backed entries (9 SQL, 5 PostgreSQL, 9 Python, 12 PySpark, 10 Databricks), 9 direct posts; no preparation banks. Catalog/source-budget validation passed. SQLite migration test RED→GREEN; existing live progress hash unchanged across loading 145 questions.
Task 2: implemented — source/subtopic filtering tests RED→GREEN. Browser checks covered candidate-only default, direct links, labels, descendant reset, practice retention and legacy study flows.

Final review: fresh read-only reviewer checked data/UI/storage and sampled primary posts. Important stale-subtopic navigation reproduced by browser regression (actual 'Scalar average and row filtering' versus expected 'all'); navigation normalization fix applied to sidebar and overview subject links through shared go(). RED→GREEN verified; final unit suite 17/17, browser checks 20/20, production build successful. Real-catalog in-memory plan check: all 145 IDs present once. Live local API: 145 questions, 45 reported entries; progress hash unchanged. Readable viewport screenshots captured and inspected.

Final: minor (deferred): tests do not assert the exact original ID set or real-catalog plan coverage, although independent current catalog/plan verification found all 145 IDs exactly once.
Final: minor (deferred): migration test creates progress after its first schema migration, so it does not simulate pre-ALTER progress rows. Actual live progress hash was checked unchanged; migration operations are additive.

Review verification limits: individual candidate accounts remain unverified; source/technical checks are not claims of employer confirmation, and Spark snippets were not run on a cluster. The parent verified the full unit and browser suites rather than relying on reviewer assertions.

Visual verification: viewport screenshot exposed missing base question-row styles (narrow centered button and joined topic/type text). Browser geometry assertion reproduced failure; restored grid/read-column base styles, verified RED→GREEN with full 17/17 unit suite, successful build and 20/20 browser checks. Final source-library screenshot inspected after correction.
