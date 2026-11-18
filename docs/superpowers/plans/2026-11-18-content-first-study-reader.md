# Content-first Study Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Study Material as a responsive, content-first technical documentation reader while preserving all current content and SQLite tracking behavior.

**Architecture:** Material view becomes a dedicated full-page documentation mode. `StudyMaterial` owns a closed-by-default course drawer, article, and contextual section rail; `App` supplies exit/theme actions and a material-specific shell class. Existing API and Redux snapshot flows remain unchanged.

**Tech Stack:** React 19, Redux Toolkit, Framer Motion, Lucide React, React Markdown, CSS, Node browser QA.

**Spec:** `docs/superpowers/specs/2026-11-18-content-first-study-reader-design.md`

## Global Constraints

- Local-only; do not deploy.
- Preserve workbook text, 875 questions, SQLite records, routes, backups, and exact resume behavior.
- Use Databricks documentation only as structural inspiration; retain Engineer Prep identity.
- Keep raw HTML inert and wide code/tables locally scrollable.

## Review Focus

- A closed drawer must not leave focusable controls in the tab order.
- Selecting a day, section, or reference must close the drawer and retain resume state.
- Tablet and mobile layouts must prioritize article width and avoid page overflow.
- Existing plan links must still open and persist the requested day.
- Dark mode and reduced motion must remain usable.

### Task 1: Browser contract for content-first material mode

**Files:**
- Modify: `scripts/browser-qa.mjs`

**Interfaces:**
- Consumes: current material page selectors and browser snapshot API.
- Produces: regression assertions for shell, drawer, article dominance, contextual rail, and responsive behavior.

- [x] Add assertions that fail against the current permanent-index layout.
- [x] Run browser QA and confirm the failure describes the missing documentation mode.

### Task 2: Documentation reader shell and responsive styling

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/StudyMaterial.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: unchanged `data.materials`, `materialSections`, `materialState`, and mutation routes.
- Produces: `StudyMaterial({data, initialDay, initialSectionId, onExit, onTheme})` and the documentation-mode DOM contract.

- [x] Add the material-specific application shell and reader actions.
- [x] Convert the index to an accessible drawer and add the contextual section rail.
- [x] Implement wide, medium, and mobile documentation layouts.
- [x] Run browser QA until the new contract and all prior checks pass.

### Task 3: Full verification and local handoff

**Files:**
- Modify: `docs/study-material-progress.md`

**Interfaces:**
- Consumes: completed source changes.
- Produces: fresh test/build/browser evidence and a running local preview.

- [x] Run the full Node test suite.
- [x] Build the production bundle.
- [x] Run browser QA and inspect desktop/mobile screenshots.
- [x] Confirm frontend/API health and keep the local app running.
