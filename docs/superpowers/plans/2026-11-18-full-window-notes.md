# Full-window Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn My notes into a focused full-window notebook and add persisted, validated code-snippet blocks.

**Architecture:** Reuse the existing `data-screen="notes"` shell state for a CSS-only full-window mode and keep the current three-pane React editor. Extend the JSON note-block union with a validated `code` record so SQLite storage and backups remain backward-compatible without a schema migration.

**Tech Stack:** React 19, Redux-backed local store mutations, SQLite (`node:sqlite`), CSS, Lucide React, existing headless Chrome QA.

**Spec:** `docs/superpowers/specs/2026-11-18-full-window-notes-design.md`

## Global Constraints

- Do not deploy.
- Preserve every existing note, section, question, progress record, and backup format.
- Supported code languages are exactly `sql`, `postgresql`, `python`, `pyspark`, `scala`, `json`, `bash`, and `text`.
- Code is stored and displayed as plain text; never execute it or inject it as HTML.
- Keep the existing responsive section/page/editor behavior.

## Review Focus

- A legacy page containing no code blocks must load unchanged.
- An unsupported code language must reject the whole note write without altering saved data.
- A 100,000-character code snippet must save; a longer snippet must fail validation.
- Entering and leaving Notes must change only the shell, not the current data or other screens.
- The full-window layout must not overflow at 390 px and must remain readable in dark mode.

---

### Task 1: Persist validated code snippets

**Files:**
- Modify: `tests/database.test.mjs`
- Modify: `server/database.mjs`

**Interfaces:**
- Consumes: existing `normalizeNoteBlock(value,index)` and JSON-backed `notes.blocks` storage.
- Produces: normalized code blocks shaped as `{id:string,type:'code',language:string,code:string}`.

- [ ] **Step 1: Write the failing database tests**

Extend the notes persistence test with a valid Python code block and assertions that it survives save, reopen, export, and restore. Add atomic-rejection assertions for language `javascript` and code longer than 100,000 characters.

- [ ] **Step 2: Run the targeted tests and verify RED**

Run: `node --test --test-name-pattern "notes persist" tests/database.test.mjs`

Expected: FAIL because `code` is not an allowed block type.

- [ ] **Step 3: Implement code-block normalization**

In `normalizeNoteBlock(value,index)`, accept `type === 'code'`, validate `language` against the exact supported list, validate `code` as text up to 100,000 characters, and return only the normalized four fields.

- [ ] **Step 4: Run the targeted and full database suites**

Run: `node --test --test-name-pattern "notes persist" tests/database.test.mjs`

Expected: PASS.

Run: `npm.cmd test`

Expected: 36 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add tests/database.test.mjs server/database.mjs
git commit -m "feat: persist note code snippets"
```

### Task 2: Build the full-window code-capable editor

**Files:**
- Modify: `scripts/browser-qa.mjs`
- Modify: `src/App.jsx`
- Modify: `src/Notes.jsx`
- Modify: `src/styles.css`
- Modify: `docs/navigation-motion-spec.md`

**Interfaces:**
- Consumes: Task 1 code-block shape and existing `Notes({data})` editor.
- Produces: `Notes({data,onExit})`, `[data-action="exit-notes"]`, `[data-add-block="code"]`, and `.note-code-editor`.

- [ ] **Step 1: Write the failing browser contract**

Before UI changes, require Notes to hide `.workspace>.sidebar` and `.app-main>.topbar`, fill the viewport, expose Exit notes, add a Python code block, save it, reload it, verify its exact language/code, exit back to Dashboard, and contain the mobile layout within 390 px.

- [ ] **Step 2: Run browser QA and verify RED**

Run: `node scripts/browser-qa.mjs`

Expected: FAIL because Notes still renders inside the portal shell and has no code button.

- [ ] **Step 3: Pass exit navigation into Notes**

Change the Notes render in `src/App.jsx` to pass `onExit={()=>go('desk')}` and update the component signature to `Notes({data,onExit})`.

- [ ] **Step 4: Implement code-block editing**

Add `code` to `blockFor(type)`, search indexing, block icon/label rendering, the language `<select>`, the plain-text code `<textarea>`, and the Code toolbar button. Keep code updates inside `changeBlock` and the existing save mutation.

- [ ] **Step 5: Implement the full-window shell**

Add `data-screen="notes"` overrides that remove outer padding, hide the portal sidebar/topbar, flatten the workspace shell, and set the notebook to at least `100dvh`. Add Exit notes to the section header and keep the responsive pane rules authoritative below 760 px.

- [ ] **Step 6: Update the motion specification**

Document that full-window entry/exit uses the existing 140 ms screen opacity transition, while pane dimensions still change immediately and reduced motion disables nonessential fades.

- [ ] **Step 7: Run browser QA and inspect screenshots**

Run: `node scripts/browser-qa.mjs`

Expected: all 22 browser checks pass with no runtime exceptions.

Inspect: `artifacts/notes-desktop.png` and `artifacts/notes-mobile.png`.

- [ ] **Step 8: Commit**

```powershell
git add scripts/browser-qa.mjs src/App.jsx src/Notes.jsx src/styles.css docs/navigation-motion-spec.md
git commit -m "feat: make notes a full-window editor"
```

### Task 3: Final verification and local handoff

**Files:**
- Modify: `docs/notes-builder-progress.md`

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: verified local build at `http://127.0.0.1:5173/` with unchanged live SQLite records.

- [ ] **Step 1: Run the complete verification matrix**

Run: `npm.cmd test`, `npm.cmd run build`, `node scripts/browser-qa.mjs`, and `git diff --check`.

Expected: 36 tests, successful production build, 22 browser checks, and no whitespace errors.

- [ ] **Step 2: Restart the local app and verify live migration safety**

Restart `npm.cmd run dev`, verify HTTP 200 for ports 5173 and 4317, and confirm the live bootstrap still reports 875 questions and the same existing note titles.

- [ ] **Step 3: Record verification**

Append the full-window/code-block result and verification totals to `docs/notes-builder-progress.md`.

- [ ] **Step 4: Commit**

```powershell
git add docs/notes-builder-progress.md
git commit -m "docs: record full-window notes verification"
```

