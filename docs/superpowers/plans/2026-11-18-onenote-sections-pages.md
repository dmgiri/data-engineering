# OneNote Sections, Pages, and Mixed-content Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent OneNote-style sections, nested pages, collapse controls, and editable table blocks to My Notes.

**Architecture:** SQLite owns the hierarchy through a new `note_sections` table and section/order columns on notes. Existing notes migrate to a default section, the local API exposes section mutations, and the React notes workspace renders one collapsible tree feeding the existing mixed-block editor.

**Tech Stack:** React 19, Redux data refresh through existing `mutate`, Node SQLite, CSS, Lucide icons, existing CDP browser QA.

**Spec:** `docs/superpowers/specs/2026-11-18-onenote-sections-pages-design.md`

## Global Constraints

- Preserve all existing note data and legacy backup compatibility.
- Store all notebook records in the local SQLite database.
- Keep links restricted to HTTP(S) and images restricted to existing safe image formats and size limits.
- Do not deploy.
- Keep mobile layouts free of horizontal page overflow.

## Review Focus

- Existing SQLite files with notes but no sections migrate without data loss.
- Unknown section IDs and malformed tables are rejected without partial writes.
- Deleting non-empty sections removes their pages atomically only after UI confirmation.
- Legacy backups without `noteSections` retain current section state and remain restorable.
- A 390 px viewport can create and navigate sections/pages without horizontal overflow.

---

### Task 1: SQLite notebook hierarchy and migration

**Files:**
- Modify: `server/database.mjs`
- Test: `tests/database.test.mjs`

**Interfaces:**
- Produces: bootstrap `noteSections`; `saveNoteSection(value)`; `deleteNoteSection(id)`; notes with `sectionId` and `order`.

- [ ] Write failing database tests for default-section migration, section persistence/collapse, page assignment/order, table validation, deletion, and backup compatibility.
- [ ] Run `node --test tests/database.test.mjs` and confirm the new tests fail for missing hierarchy behavior.
- [ ] Add additive schema migration, normalization, mutations, bootstrap/export/import support, and table-block validation.
- [ ] Run `node --test tests/database.test.mjs` and confirm it passes.

### Task 2: Local section API

**Files:**
- Modify: `server/index.mjs`
- Test: `tests/database.test.mjs`

**Interfaces:**
- Consumes: Task 1 database methods.
- Produces: `POST /api/note-sections` and `DELETE /api/note-sections/:id`.

- [ ] Add failing HTTP assertions for saving and deleting sections.
- [ ] Run the targeted database test and confirm the routes are missing.
- [ ] Add the two local-only mutation routes.
- [ ] Run the targeted and full Node test suite.

### Task 3: OneNote-style tree and table editor

**Files:**
- Modify: `src/Notes.jsx`
- Modify: `src/styles.css`
- Test: `scripts/browser-qa.mjs`

**Interfaces:**
- Consumes: bootstrap `noteSections`, notes with `sectionId`, and Task 2 routes.
- Produces: section/page tree actions and `table` block editing controls.

- [ ] Add failing browser assertions for creating, renaming, collapsing, and deleting sections; creating nested pages; editing a table; reload persistence; and mobile overflow.
- [ ] Run `node scripts/browser-qa.mjs` and confirm failure because the hierarchy controls are absent.
- [ ] Implement the section/page tree, page assignment, table row/column/cell controls, and responsive CSS.
- [ ] Update the motion inventory for section expansion and reduced-motion behavior.
- [ ] Build and run browser QA until all checks pass without runtime exceptions.

### Task 4: Final verification

**Files:**
- Modify: `docs/notes-builder-progress.md`

- [ ] Run `npm test` and require zero failures.
- [ ] Run `npm run build` and require exit code 0.
- [ ] Run `node scripts/browser-qa.mjs` and require all browser checks to pass.
- [ ] Confirm the live frontend and API return HTTP 200 locally.
