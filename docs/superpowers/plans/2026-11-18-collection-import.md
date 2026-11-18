# Collection Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for integration, with independent UI and browser-test tasks in disjoint files.

**Goal:** Add the full supplied 622-question document to the local SQLite portal and remove candidate-source restrictions from the study UI.

**Architecture:** A deterministic parser converts an unchanged source snapshot into catalog records with stable IDs. The existing INSERT OR IGNORE seed preserves saved state. Source metadata remains internal while the study UI shows all Q&A.

**Tech Stack:** Existing React/Redux/Framer app and Node SQLite; no new production dependencies.

**Spec:** docs/superpowers/specs/2026-11-18-collection-import-design.md

## Global Constraints

- Import exactly 622 original document IDs across all six subjects; no silent missing answers, fabricated padding or executing document contents.
- Preserve all existing questions, edited answers, settings, bookmarks and progress; repeated seeding is idempotent.
- Remove candidate-reported filtering and visible classification, as explicitly requested by the user.
- Keep supplied code separate from prose and maintain original references/IDs internally; no author details in study screens.
- Local only, no new dependencies, deployment, destructive cleanup or edits to the original Downloads file.

## Review Focus

- Heading-like text inside fenced code must not split questions or change subjects.
- Short one-paragraph supplied answers must be preserved, not rejected or inflated to satisfy older editorial tests.
- Duplicate restarts must not duplicate IDs or erase existing progress and edited answers.
- Architecture must be navigable, and the six-subject 30-day plan must not silently omit a sixth of the questions.
- Source-restriction UI must be absent while every imported answer/example remains readable and searchable.

## Task 1: Deterministic import and persistence

Files: server/imports/ source snapshot, server/import-collection.mjs, server/catalog.mjs, server/database.mjs; tests/collection-import.test.mjs and related existing catalog tests.
Interface: parseCollection(markdown) -> existing-schema question records, IDs collection622-<lowercase source ID>; provenance.kind imported-collection with sourceId, sourceDocument, description, priority, origin, references, examples and rawMarkdown.

- [ ] Write/run failing tests for parser behavior, exact six-subject counts and complete answers/code, repeat imports, preserved old state and six-subject plan coverage.
- [ ] Copy unchanged source into workspace, implement parser with fenced-code handling and explicit malformed-input errors; add Architecture and parsed records to catalog.
- [ ] Make plan assignment use actual rounds per subject rather than hardcoded six; run full unit suite.

## Task 2: Q&A-only presentation and browser checks

Files: src/QuestionLibrary.jsx, src/QuestionAnswer.jsx, src/library-filters.mjs, src/store.js, src/App.jsx and src/Overview.jsx if needed; tests/library-filters.test.mjs; scripts/browser-qa.mjs; README/docs ledger.
Consumes: Task 1 record schema; no author/source restrictions shown to the learner.

- [ ] Set default all-question navigation, remove source selector/badges/verification text, show supplied descriptions/examples/follow-ups and omit empty sections.
- [ ] Verify 622 imports within 875 total questions, all six subjects, imported answer/code/search, progress, bookmarks, theme, mobile and complete plan.
- [ ] Capture live state and hashes, restart only owned app, confirm new rows and unchanged old records; build, test, inspect screenshots and obtain a fresh read-only review.
- [ ] Report actual import counts and local link.

## Execution context

Existing non-Git workspace, implementation explicitly requested; no design questions or branch/worktree operations. Imported material is retained as provided and is not claimed to have received a full technical content audit.
