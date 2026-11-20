# Notes Clipboard Image Paste Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users paste supported clipboard images directly into an open My Notes page.

**Architecture:** Extract clipboard inspection and image validation into a small pure helper module. The Notes component listens for paste events, preserves native paste in editable controls, converts the accepted image to a data URL, and inserts it through the existing block/layout state.

**Tech Stack:** React 19, browser Clipboard API events, FileReader, Node test runner, headless Chrome QA

**Spec:** `docs/superpowers/specs/2026-11-20-notes-image-paste-design.md`

## Global Constraints

- Support PNG, JPEG, WebP, and GIF up to 2 MB.
- Do not intercept normal text or code paste.
- Do not create an image block when no note is open or no valid image exists.
- Add no dependency.

## Review Focus

- Mixed clipboard content selects the first supported image.
- Oversized images show a message without creating a block.
- Unsupported clipboard files do not alter the note.
- Pasting text into text/code/title controls stays native.
- Pasted image data persists after save and reload.

---

### Task 1: Clipboard image selection

**Files:**
- Create: `src/note-image-clipboard.mjs`
- Create: `tests/note-image-clipboard.test.mjs`

**Interfaces:**
- Produces: `SUPPORTED_NOTE_IMAGE_TYPES`, `validateNoteImage(file)`, `clipboardImage(items)`.

- [ ] Write tests for supported, unsupported, mixed, empty, and oversized clipboard files.
- [ ] Run the focused test and confirm it fails because the helper does not exist.
- [ ] Implement the pure helper with the existing 2 MB limit.
- [ ] Run the focused test and confirm it passes.

### Task 2: Notes paste integration

**Files:**
- Modify: `src/Notes.jsx`
- Modify: `scripts/browser-qa.mjs`

**Interfaces:**
- Consumes: `validateNoteImage(file)` and `clipboardImage(items)` from Task 1.
- Produces: direct clipboard-image insertion into the existing image block model.

- [ ] Add a browser assertion that dispatches an image paste and expects one populated, selected image block with unsaved state.
- [ ] Run browser QA against a fresh build and confirm the assertion fails.
- [ ] Add the Notes paste handler, native-editable guard, FileReader conversion, and block insertion.
- [ ] Verify save/reload persistence and native text paste behavior in browser QA.
- [ ] Run all tests, browser QA, and the production build.
- [ ] Commit the verified feature on `feature/notes-image-paste`.
