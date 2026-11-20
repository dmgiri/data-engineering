# Empty Note Containers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve click-anywhere typing while preventing untouched blank text containers from remaining visible or reaching SQLite.

**Architecture:** Track click-created text blocks as temporary client-side IDs. Promote one to normal content only when it contains non-whitespace text; otherwise remove it on blur and filter whitespace-only text blocks before save.

**Tech Stack:** React 19, Vite, browser QA through Chrome CDP, SQLite API

**Spec:** `docs/superpowers/specs/2026-11-20-empty-note-containers-design.md`

## Global Constraints

- Keep click-anywhere placement and focus behavior.
- Do not change link, image, table, code, drag, resize, or layering behavior.
- Never persist whitespace-only text containers.

## Review Focus

- Repeated blank clicks leave only the currently focused temporary container.
- Clicking a toolbar or navigation control removes an untouched temporary container.
- Whitespace input remains temporary; non-whitespace input becomes real content.
- Saving a title-only page persists zero blocks.
- Existing saved empty text blocks are removed on the next save.

---

### Task 1: Make click-created blank text temporary

**Files:**
- Modify: `scripts/browser-qa.mjs`
- Modify: `src/Notes.jsx`

**Interfaces:**
- Consumes: existing `addTextAt`, `addBlock`, `changeBlock`, `save`, and `.note-canvas-item` behavior.
- Produces: client-only temporary block tracking; persisted note payloads contain no whitespace-only text blocks.

- [ ] **Step 1: Write the failing browser checks**

Add assertions that two consecutive blank-canvas clicks do not accumulate two empty items, blurring an untouched item removes it without a dirty state, typing whitespace does not promote it, typing real text retains it, and saved snapshots contain no empty text blocks.

- [ ] **Step 2: Run the browser QA and verify RED**

Run: `node scripts/browser-qa.mjs`

Expected: FAIL because the current editor keeps every click-created blank text block.

- [ ] **Step 3: Implement temporary text-container lifecycle**

In `src/Notes.jsx`, keep temporary block IDs in a ref, remove untouched temporary text blocks on blur or replacement, promote on the first non-whitespace edit, avoid marking the draft dirty for temporary-only creation/removal, and filter whitespace-only text blocks in `save`.

- [ ] **Step 4: Verify GREEN and regression safety**

Run: `node scripts/browser-qa.mjs`, `npm.cmd test`, `npm.cmd run build`, and `git diff --check`.

Expected: 22 browser checks, 37 unit tests, successful production build, and no whitespace errors.

- [ ] **Step 5: Commit**

```bash
git add scripts/browser-qa.mjs src/Notes.jsx docs/superpowers/plans/2026-11-20-empty-note-containers.md
git commit -m "fix: discard blank note containers"
```
