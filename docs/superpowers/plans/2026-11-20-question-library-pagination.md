# Question Library Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add responsive, accessible pagination to the Q&A library.

**Architecture:** A pure pagination module handles slicing, clamping, ranges, and compact page tokens. The React library view keeps local page state and resets it through the existing filter change handler.

**Tech Stack:** React 19, Redux Toolkit filters, CSS, Node test runner, Chrome browser QA

**Spec:** `docs/superpowers/specs/2026-11-20-question-library-pagination-design.md`

## Global Constraints

- Work directly on `main`.
- Page size is exactly 20.
- Existing filtering, bookmarks, answer navigation, and responsive behavior must remain intact.

## Review Focus

- Empty results must show no invalid range or enabled page navigation.
- Exact multiples of 20 must not create an extra page.
- Result shrinkage must clamp safely before rendering.
- Search and every filter control must reset to page 1.
- Mobile controls must not create horizontal overflow.

---

### Task 1: Pagination helper and Q&A controls

**Files:**
- Create: `src/pagination.mjs`
- Create: `tests/pagination.test.mjs`
- Modify: `src/QuestionLibrary.jsx`
- Modify: `src/styles.css`
- Modify: `scripts/browser-qa.mjs`

**Interfaces:**
- Produces: `paginate(items, requestedPage, pageSize)` returning `{items,page,pageCount,start,end,total}`.
- Produces: `pageTokens(page,pageCount)` returning page numbers and `'ellipsis'` tokens.

- [ ] Add failing pure tests for empty, first, middle, last, exact-boundary, clamped, and compact-token cases.
- [ ] Implement the smallest pure helper and verify its tests.
- [ ] Add failing browser assertions for 20 rows, visible range, page navigation, and filter reset.
- [ ] Integrate local page state and accessible controls, then style desktop/mobile layouts.
- [ ] Run pagination tests, full tests, browser QA, production build, and commit on `main`.
