# Installer Username Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ask for and persist the dashboard display name during CMD production installation.

**Architecture:** Extend `install.ps1`, which is invoked by `install.cmd`, with a `-UserName` parameter and interactive name collection. Reuse the local settings API after build/restore, starting a temporary production server only when the app is not already running.

**Tech Stack:** Windows CMD/PowerShell, Node.js local HTTP API, SQLite

**Spec:** `docs/superpowers/specs/2026-11-20-installer-username-design.md`

## Global Constraints

- First interactive install requires a name; reinstall blank keeps the current name.
- Names are trimmed and limited to 40 characters.
- Apply the supplied name after backup restore.
- Never edit or delete `.data` directly.

## Review Focus

- Whitespace-only first-install input must reprompt instead of accepting an invisible name.
- Quotes and JSON-sensitive characters in names must be encoded safely.
- An API rejection must fail installation without corrupting settings.
- Temporary-server cleanup must happen after both success and failure.
- Non-interactive installation without `-UserName` must preserve current behavior and data.

---

### Task 1: Username collection and persistence

**Files:**
- Modify: `tests/installer.test.mjs`
- Modify: `install.ps1`
- Modify: `README.md`

**Interfaces:**
- Produces: `install.ps1 -UserName <string>` and interactive `Enter your name` prompt.
- Consumes: existing `PUT /api/settings` partial-update contract.

- [ ] Add failing tests for interactive prompt text, first-install requirement, non-interactive dry-run output, 40-character validation, API-safe JSON creation, and README guidance.
- [ ] Run the focused installer suite and confirm the username tests fail for missing behavior.
- [ ] Implement name collection, validation, post-restore API persistence, and documentation.
- [ ] Run focused tests, full tests, CMD dry-run, and production build.
- [ ] Commit the verified change.
