# Candidate-reported library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an honestly attributed LinkedIn interview batch with detailed original answers and topic/subtopic browsing.

**Architecture:** Researchers own separate JSON batches under server/interviews. The catalog merges these with retained practice material. SQLite migrates metadata additively; Redux filters expose the hierarchy and source distinction without changing the site's style.

**Tech Stack:** Existing React, Redux Toolkit, Framer Motion, Node24 SQLite; no new dependencies.

**Spec:** docs/superpowers/specs/2026-11-18-linkedin-library-design.md

## Global Constraints

- Candidate-reported experiences only; accept fewer than 100–200 per subject until more sources are found.
- Preserve all existing records and the current UI style; local-only, no deployment.
- Link direct LinkedIn posts, distinguish reported questions from reported topics, and label original answers.
- No preparation-bank filler, invented companies, or claims of independent interview verification.

## Review Focus

- A direct LinkedIn page contains unrelated recommended posts: attribute only its primary body.
- Existing SQLite files must migrate without losing questions, bookmarks, reviews or sessions.
- Changing subject/topic must reset incompatible lower-level filters rather than silently hiding content.
- A subject has very few sourced questions: display the actual count, not the research target as availability.
- Existing tests and 30-day plan must continue to cover retained IDs and new IDs exactly once.

## Task 1: Source and persist metadata

Files: server/interviews/*.json, server/catalog.mjs, server/database.mjs, tests/provenance.test.mjs, tests/catalog.test.mjs.
Interface: questions gain subtopic:string and provenance:null|{kind,url,author,title,company,experience,accessedAt,note,scope}. sourceUrl remains the official technical reference.

- [ ] Write/run failing SQLite migration/reopen tests and content source validation tests.
- [ ] Independently research candidate sources in separate data files; spot-check their primary bodies.
- [ ] Merge batches into catalog, migrate metadata with explicit insert columns, retain every original ID and user record.
- [ ] Run full unit suite; report actual per-subject counts.

## Task 2: Browse by source/topic/subtopic

Files: src/library-filters.mjs, src/QuestionLibrary.jsx, src/App.jsx, src/QuestionAnswer.jsx, src/store.js, src/styles.css, tests/library-filters.test.mjs, scripts/browser-qa.mjs.
Interface: sourceKind='all'|'candidate-reported'|'practice', subtopic='all'|string; pure filterQuestions(questions,filters,bookmarks) returns matching rows. Existing route and row markup are retained.

- [ ] Write/run failing real filter tests for source distinction, subtopic scope, source text search and saved records.
- [ ] Add source/topic/subtopic controls, source counts and provenance in answers; default new library to candidate-reported.
- [ ] Extend isolated browser QA to filter/open a sourced answer, verify links and labels, and check existing practice flows.
- [ ] Run tests, build, browser checks, and fresh code/source review; fix material findings with regression tests.

## Execution notes

User previously requested direct implementation without further planning delays. This is the retained checkout, not a Git repository; no branch, commit or worktree operations are applicable. Preserve the running local server and use isolated test data.
