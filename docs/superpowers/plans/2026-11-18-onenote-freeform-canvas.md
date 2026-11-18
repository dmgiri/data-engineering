# OneNote Freeform Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a persistent OneNote-style canvas where clicking any blank point creates editable text and every note item can be moved and resized.

**Architecture:** Extend each existing JSON note block with an optional validated layout object, preserving legacy records. Hydrate missing layouts in React, render all blocks in an absolute-positioned canvas layer, and implement creation, dragging, resizing, focus, and z-order through pointer events.

**Tech Stack:** React 19, controlled pointer events, CSS, Node SQLite, existing local JSON API, Node test runner, Chrome CDP browser QA.

**Spec:** `docs/superpowers/specs/2026-11-18-onenote-freeform-canvas-design.md`

## Global Constraints

- Preserve every existing note and section without destructive migration.
- Keep the explicit Save action; do not add autosave.
- Do not add a new runtime dependency.
- Keep all spatial overflow inside the Notes canvas at 390 px and wider.
- Validate all persisted coordinates and sizes server-side.

## Review Focus

- A click on an existing textarea/control must never create a duplicate text item.
- Pointer release outside the item or canvas must still finish drag/resize cleanly.
- Legacy blocks without layout must remain readable and save with deterministic positions.
- Empty pages and deletion of the final item must remain valid.
- Touch/mobile interaction must not cause document-level horizontal overflow.

---

### Task 1: Persist optional block layout safely

**Files:**
- Modify: `tests/database.test.mjs`
- Modify: `server/database.mjs`

**Interfaces:**
- Produces: block `layout?: {x:number,y:number,width:number,height:number,z:number}` accepted and returned by `saveNote`, backup, restore, and reopen.
- Produces: note `blocks` may be an empty array.

- [ ] **Step 1: Write failing database tests** for a positioned block surviving save/reopen/backup, legacy blocks staying valid, an empty page saving, and out-of-range/non-finite layout values rejecting atomically.
- [ ] **Step 2: Run `node --test tests/database.test.mjs`** and verify failures are caused by layout being stripped and empty blocks being rejected.
- [ ] **Step 3: Add `normalizeNoteLayout(value, index)`** in `server/database.mjs`; validate exact integer bounds from the spec and include layout only when supplied.
- [ ] **Step 4: Allow zero to 100 blocks** while retaining unique-ID and content validation.
- [ ] **Step 5: Run `node --test tests/database.test.mjs`** and verify all database tests pass.
- [ ] **Step 6: Commit** with `git commit -m "feat: persist freeform note layouts"`.

### Task 2: Hydrate legacy notes and create spatial items

**Files:**
- Modify: `scripts/browser-qa.mjs`
- Modify: `src/Notes.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: optional validated block `layout` from Task 1.
- Produces: `defaultBlockLayout(block, index)`, hydrated drafts, `.note-spatial-layer`, and `.note-canvas-item` elements positioned from controlled state.

- [ ] **Step 1: Add failing browser assertions** that legacy content renders as positioned items, a blank-layer click creates exactly one text item near the clicked coordinate, and its textarea receives focus.
- [ ] **Step 2: Run `node scripts/browser-qa.mjs`** and verify it fails because the spatial layer does not exist.
- [ ] **Step 3: Implement type-aware deterministic defaults** and hydrate layouts whenever a saved note becomes the draft.
- [ ] **Step 4: Replace flow block rendering with a relative spatial layer** whose size derives from item extents and viewport minimums.
- [ ] **Step 5: Implement blank-click text creation** using layer-relative coordinates, stop propagation from items/controls, and focus the new textarea.
- [ ] **Step 6: Change ribbon insertion** to place new blocks at the last canvas point or visible-origin fallback; allow removing the final item.
- [ ] **Step 7: Run the browser QA** and verify creation, existing content, save, reload, and current section/page flows pass.
- [ ] **Step 8: Commit** with `git commit -m "feat: add click-anywhere note canvas"`.

### Task 3: Move, resize, layer, and contain canvas items

**Files:**
- Modify: `scripts/browser-qa.mjs`
- Modify: `src/Notes.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `.note-canvas-item` and controlled block layouts from Task 2.
- Produces: item drag handles, resize handles, pointer capture lifecycle, bounded layouts, and z-order promotion.

- [ ] **Step 1: Add failing browser assertions** that pointer dragging changes `x/y`, resizing changes `width/height`, item focus promotes `z`, reload restores geometry, and document width stays contained at 390 px.
- [ ] **Step 2: Run `node scripts/browser-qa.mjs`** and verify the geometry assertions fail for missing interactions.
- [ ] **Step 3: Implement a single pointer interaction state** containing mode, block ID, origin pointer, and origin layout; use pointer capture and window-level cancellation cleanup.
- [ ] **Step 4: Add drag and resize handles** with accessible labels, minimum bounds, non-negative positions, and z-order promotion.
- [ ] **Step 5: Add spatial canvas CSS** for selected/hover states, touch-action rules, contained scrolling, block-specific content sizing, reduced motion, and mobile containment.
- [ ] **Step 6: Run `node scripts/browser-qa.mjs`**, inspect desktop/mobile screenshots, and correct visual or overflow regressions.
- [ ] **Step 7: Run `npm.cmd test`, `npm.cmd run build`, and `git diff --check`**; require 36+ Node tests and all browser checks passing.
- [ ] **Step 8: Commit** with `git commit -m "feat: move and resize note canvas items"`.

