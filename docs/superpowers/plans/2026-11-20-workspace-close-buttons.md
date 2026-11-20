# Workspace Close Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add prominent red Close buttons to Study Material and My Notes.

**Architecture:** Reuse each view's existing exit callback and add a shared CSS class inside the existing top toolbars. Preserve the Notes unsaved-change guard.

**Tech Stack:** React, Lucide React, CSS, browser QA

**Spec:** `docs/superpowers/specs/2026-11-20-workspace-close-buttons-design.md`

## Global Constraints

- Return to Dashboard from both buttons.
- Keep the control visible on mobile.
- Do not add dependencies.

## Review Focus

- Unsaved Notes still prompt before leaving.
- Buttons remain visible at 390px.
- The red styling is readable in both themes.
- Existing Study Material navigation remains usable.
- Existing Notes ribbon actions remain usable.

---

### Task 1: Close controls

**Files:**
- Modify: `scripts/browser-qa.mjs`
- Modify: `src/StudyMaterial.jsx`
- Modify: `src/Notes.jsx`
- Modify: `src/styles.css`

- [ ] Add failing browser assertions for both top-right red Close buttons.
- [ ] Run browser QA and confirm the controls are missing.
- [ ] Add the buttons using existing exit callbacks and shared responsive styles.
- [ ] Run unit tests, browser QA, and the production build.
- [ ] Commit the verified change on `main`.
