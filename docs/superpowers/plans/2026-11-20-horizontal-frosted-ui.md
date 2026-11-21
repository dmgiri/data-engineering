# Horizontal Frosted UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved responsive frosted UI with horizontal global navigation and wider Material and Notes workspaces.

**Architecture:** Keep the existing React/Redux/SQLite application behavior and replace only the shared shell and dashboard presentation. Material and Notes continue to own their internal navigation panes.

**Tech Stack:** React 19, Redux Toolkit, Framer Motion, Lucide React, CSS, Node test runner

**Spec:** `docs/superpowers/specs/2026-11-20-horizontal-frosted-ui-design.md`

## Global Constraints

- Preserve all existing APIs, SQLite records, editor behavior, and routes.
- Dark mode is neutral charcoal/graphite, not navy.
- Global navigation is horizontal at desktop and mobile widths.
- Respect reduced motion and keyboard accessibility.

## Review Focus

- Long navigation labels must scroll without causing page overflow.
- Material chapter navigation must retain usable width and collapse behavior.
- Notes section/page panes and spatial editor must remain functional.
- Theme switching must update every shared-shell surface.
- Existing deep links and active navigation state must remain correct.

---

### Task 1: Horizontal application shell

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Test: `tests/horizontal-shell.test.mjs`

**Interfaces:**
- Consumes: existing `navigate(view, extra)` and Redux `view` state
- Produces: `.app-header`, `.primary-nav`, `.primary-nav-item`, and unchanged view routing

- [ ] Write and run a failing source contract test for horizontal navigation and the absence of the desktop sidebar shell.
- [ ] Implement the shared header and accessible active navigation.
- [ ] Add responsive light/dark shell styles and verify the focused test passes.

### Task 2: Dashboard HUD

**Files:**
- Modify: `src/Overview.jsx`
- Modify: `src/styles.css`
- Test: `tests/horizontal-shell.test.mjs`

**Interfaces:**
- Consumes: existing study metrics, questions, plan, progress, and navigation callbacks
- Produces: target, streak, progress, weekly activity, readiness, and next-question cards

- [ ] Add failing assertions for the approved dashboard regions.
- [ ] Recompose existing data into the new HUD without changing persistence.
- [ ] Implement responsive dashboard styles and pass the focused test.

### Task 3: Material and Notes workspace fit

**Files:**
- Modify: `src/styles.css`
- Test: `tests/horizontal-shell.test.mjs`

**Interfaces:**
- Consumes: existing Material and Notes component class names
- Produces: full-width content areas beneath the shared header

- [ ] Add failing assertions for Material and Notes width/overflow contracts.
- [ ] Update workspace sizing and responsive rules while preserving their inner navigation.
- [ ] Run focused tests, full tests, and production build.

