# Synthex Study Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rejected room UI with a coherent mint/slate reference-led study dashboard.
**Architecture:** Keep all existing study and SQLite mutations. Replace the shell, overview, and styling; isolate real-data aggregation in one small tested module.
**Tech Stack:** Existing React, Redux Toolkit, Framer Motion, Lucide, CSS, Node SQLite. No extra dependencies.
**Spec:** docs/synthex-redesign.md

## Global Constraints

Local only. Preserve SQLite records. Readable 14–16px content. Light/dark, mobile, reduced motion. No fabricated progress.

## Review Focus

Empty data must remain zero; charts must not show fictional growth. Small screens must stack rather than shrink columns. Keyboard navigation must retain drafts. Timer must not obscure answers. Appearance changes must not overwrite other preferences.

### Task 1: Actual study metrics

- [x] Add `tests/study-metrics.test.mjs`; observe the missing feature fail.
- [x] Implement `studyMetrics(data, range, subject, endDate)` in `src/study-metrics.mjs`.
- [x] Verify calendar, subject, and zero-data behavior with `node --test tests/study-metrics.test.mjs`.

### Task 2: Reference-led presentation

- [ ] Add `src/Overview.jsx`: progress summaries, filterable activity, today's question list, subject coverage.
- [ ] Update `src/App.jsx`: full sidebar, compact header, active timer only; retain all existing subview behavior.
- [ ] Replace `src/styles.css` with shared light/dark tokens and responsive rules; remove obsolete spatial imports.
- [ ] Update `scripts/browser-qa.mjs` to assert new overview, live filters, readable type, mobile stacking, and all existing save flows.

### Task 3: Verify and show

- [ ] Run `npm.cmd test`, `npm.cmd run build`, and `node scripts/browser-qa.mjs`.
- [ ] Inspect rendered overview, reading, and mobile screenshots, correcting observed issues.
- [ ] Keep the local app running and hand back http://127.0.0.1:5173. No deployment.
