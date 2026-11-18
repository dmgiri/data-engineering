# Simple Notes Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a responsive local notes workspace supporting text, links, and images persisted in SQLite.

**Architecture:** Add one additive `notes` table whose `blocks` column contains a strictly validated JSON array. Expose save and delete routes through the existing local-only JSON API, surface notes in bootstrap and backup, and render a focused React block form in a separate lazy-loadable view.

**Tech Stack:** React 19, Redux Toolkit, Lucide React, Node `http`, built-in `node:sqlite`, CSS.

**Spec:** `docs/superpowers/specs/2026-11-18-simple-notes-builder-design.md`

## Global Constraints

- Local only; do not deploy.
- Preserve all existing questions, progress, settings, and study material.
- Image formats: PNG, JPEG, WebP, GIF; maximum 2 MB per image.
- Links must use `http:` or `https:`.
- Existing version-1 backups without notes remain compatible.

## Review Focus

- Malformed block arrays must fail without altering saved notes.
- Oversized or unsafe image data URLs must be rejected.
- `javascript:` links must be rejected.
- Restoring a legacy backup must preserve current notes.
- The editor must not overflow a 390 px viewport.

---

### Task 1: SQLite note model and local API

**Files:**
- Modify: `server/database.mjs`
- Modify: `server/index.mjs`
- Test: `tests/database.test.mjs`

**Interfaces:**
- Produces: `bootstrap().notes`, `saveNote(value)`, `deleteNote(noteId)`.
- Produces: `POST /api/notes` and `DELETE /api/notes/:id`.

- [ ] Write failing database and HTTP tests for create, update, delete, reopen, invalid blocks, backup, and legacy restore.
- [ ] Run `node --test tests/database.test.mjs` and verify the missing notes interface fails.
- [ ] Add the table, normalizers, CRUD methods, bootstrap field, backup handling, and routes.
- [ ] Run `node --test tests/database.test.mjs` and verify it passes.

### Task 2: Responsive block-form workspace

**Files:**
- Create: `src/Notes.jsx`
- Modify: `src/App.jsx`
- Modify: `src/StudyMaterial.jsx`
- Modify: `src/styles.css`
- Test: `scripts/browser-qa.mjs`

**Interfaces:**
- Consumes: `data.notes`, `mutate('/api/notes', 'POST', note)`, and `mutate('/api/notes/:id', 'DELETE', {})`.
- Produces: `[data-view="notes"]`, `.notes-workspace`, `.note-editor`, and accessible block controls.

- [ ] Write a failing browser contract for navigation, note creation, all three block types, persistence, deletion, and 390 px containment.
- [ ] Build the note list, editor, block controls, image validation feedback, and responsive styling.
- [ ] Build production assets, then run `node scripts/browser-qa.mjs` and verify all checks pass.

### Task 3: Full regression and local handoff

**Files:**
- Modify: `README.md`
- Modify: `docs/study-material-progress.md`

**Interfaces:**
- Consumes: completed database, API, and UI work.
- Produces: documented backup behavior and a verified local link.

- [ ] Document notes, supported images, backup behavior, and local-only storage.
- [ ] Run `npm.cmd test`, `npm.cmd run build`, and `node scripts/browser-qa.mjs` fresh.
- [ ] Confirm `http://127.0.0.1:5173/#notes` and `/api/bootstrap` return HTTP 200.
