# PostgreSQL Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for integration. Independent research batches use disjoint files.

**Goal:** Expand the local PostgreSQL interview library with sourced Q&A, targeting 100–200 without relaxing the candidate-reported-only rule.

**Architecture:** Existing catalog auto-discovers JSON batches, and SQLite inserts new IDs without overwriting existing rows. Independent researchers verify candidate posts in separate topic domains; parent deduplicates and integrates.

**Tech Stack:** Existing React/Redux/Framer app, JSON catalog and Node SQLite. No dependency changes or deployment.

**Spec:** docs/superpowers/specs/2026-11-18-postgres-expansion-design.md

## Global Constraints

- Candidate-reported LinkedIn sources only; fewer supported entries are acceptable, generic banks are not.
- Preserve Q&A-first UI with no author panels and all existing IDs/progress.
- Two independently written answer paragraphs, at least 80 words, with official PostgreSQL documentation.
- Direct source body, concise paraphrases, explicit reported-question/reported-topic scope; combined title/prompt budget no more than 200 words per post across all subjects.
- PostgreSQL-specific provenance required; no generic SQL reclassification or artificial topic splitting.
- No writes to the user's existing PostgreSQL instance or external deployment.

## Review Focus

- LinkedIn recommendation panels are not the body of the containing source URL.
- PostgreSQL hashtags alone do not establish that generic SQL questions were asked about PostgreSQL.
- Topic-only interview reports must not be inflated into many specific reported questions.
- Technical answers must qualify version-sensitive behavior, snapshots, locking and replication guarantees.
- New rows must preserve saved answers, prior IDs, settings and progress.

## Task 1: Research and add supported PostgreSQL entries

Files: server/interviews/postgres-queries.json, postgres-concurrency.json, postgres-operations.json, postgres-integration.json; tests/postgres-expansion.test.mjs.
Interface: existing question/provenance schema, IDs li-postgres-a/b/cNNN; no shared batch editing.

- [ ] Write expansion/provenance and real SQLite-retention tests; run at five sourced PostgreSQL entries and observe the expected failure.
- [ ] Verify direct candidate reports and official docs, author detailed original answers and code where appropriate.
- [ ] Deduplicate across batches and original five sourced entries, check per-source wording budgets and source scope.
- [ ] Run full unit suite; report actual count rather than changing the source rules to meet a quota.

## Task 2: Load and verify locally

Files: scripts/browser-qa.mjs, README.md, docs/linkedin-source-register.md, docs/postgres-expansion-progress.md.
Consumes: expanded catalog. Produces: persisted SQLite rows and accurate UI count.

- [ ] Add a PostgreSQL browser check comparing actual SQLite count, question source/explanation and topic filters; inspect screenshot.
- [ ] Capture live progress/settings/IDs, restart only owned local app, compare unchanged state.
- [ ] Run tests, build and browser suite; obtain a fresh read-only review and fix material findings.
- [ ] Report supported count, limitations and local link. No deployment.

## Execution context

User already requested execution and repeatedly opted out of process questions. Existing non-Git workspace is the intended local project; no Git branch/worktree operations apply.
