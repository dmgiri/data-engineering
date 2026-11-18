# Study Material Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the supplied 30-day workbook into the local React portal with SQLite-backed section completion and resume tracking.

**Architecture:** A deterministic fence-aware parser converts the inert Markdown source into material, chapter, and section records. SQLite seeds content separately from learner state, while a dedicated React reader renders safe Markdown and saves completion/resume mutations through the existing local API and Redux snapshot flow.

**Tech Stack:** Node 24, built-in SQLite, React 19, Redux Toolkit, Framer Motion, `react-markdown`, `remark-gfm`, CSS.

**Spec:** `docs/superpowers/specs/2026-11-18-study-material-tracking-design.md`

## Global Constraints

- Local-only; no deployment or external runtime services.
- Treat document text as inert data and never execute embedded code or HTML.
- Preserve every existing question and progress row.
- Keep earlier version-1 backups valid; material tracking fields are optional.
- Follow the current course-dashboard visual language and accessibility behavior.

## Review Focus

- A fake day or section heading inside a fenced code block must not split imported content.
- Re-importing the catalog must not reset completed sections or the last-read position.
- An older backup without material fields must import without deleting current material state unexpectedly.
- Raw HTML in Markdown must not execute in the browser.
- Mobile navigation and long code/table content must remain usable without page-width overflow.

---

### Task 1: Deterministic workbook import

**Files:**
- Create: `server/imports/30-day-data-engineering-interview-prep.md`
- Create: `server/import-study-material.mjs`
- Modify: `server/catalog.mjs`
- Test: `tests/study-material-import.test.mjs`

**Interfaces:**
- Produces: `parseStudyMaterial(markdown, metadata) -> material` and `studyMaterials` catalog records.

- [x] Write parser tests for exact day/checkpoint counts, first/last headings, code preservation, resource chapters, and fenced fake headings.
- [x] Run the focused test and verify it fails because the importer is absent.
- [x] Copy the source snapshot and implement the minimal parser/catalog integration.
- [x] Run the focused test and the full suite.

### Task 2: SQLite persistence, API, and backups

**Files:**
- Modify: `server/database.mjs`
- Modify: `server/index.mjs`
- Modify: `tests/database.test.mjs`

**Interfaces:**
- Consumes: `catalog.materials` from Task 1.
- Produces: `saveMaterialProgress(sectionId, completed)`, `saveMaterialState(value)`, bootstrap material records, and local API routes.

- [x] Write failing database and HTTP tests for seeding, toggle completion, resume state, idempotent reopen, and old/new backup compatibility.
- [x] Run the focused tests and verify the expected missing-schema/API failures.
- [x] Add additive tables, validation, mutations, bootstrap fields, export, and import handling.
- [x] Run the focused tests and the full suite.

### Task 3: Study material reader and tracking UI

**Files:**
- Create: `src/StudyMaterial.jsx`
- Modify: `src/App.jsx`
- Modify: `src/Overview.jsx`
- Modify: `src/store.js`
- Modify: `src/styles.css`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `scripts/browser-qa.mjs`

**Interfaces:**
- Consumes: bootstrap `materials`, `progress.materialSections`, and `progress.materialState` from Task 2.
- Produces: navigable reader, search, completion controls, resume behavior, and plan/progress integration.

- [x] Add failing browser assertions for material navigation, 30-day/302-checkpoint totals, safe rendering, completion persistence, resume, search, mobile layout, and no runtime exceptions.
- [x] Install Markdown rendering dependencies and implement the reader plus current-design styling.
- [x] Add Study Material to primary navigation, link plan days, and show completion in Daily Progress.
- [x] Run unit tests, production build, and browser QA.

### Task 4: Documentation and preservation audit

**Files:**
- Modify: `README.md`
- Create: `docs/study-material-progress.md`

**Interfaces:**
- Consumes: final verified counts, source hash, and test evidence.

- [x] Record the import contract, counts, tracking semantics, backup behavior, and local usage.
- [x] Compare live database question/progress identities before and after restart.
- [x] Run fresh full tests, build, and browser QA; inspect desktop and mobile screenshots.
