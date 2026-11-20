# Production Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive production-only Windows installer and launcher for the local study portal.

**Architecture:** Two root-level PowerShell scripts perform installation and launching. Tests execute their non-mutating validation/dry-run paths and inspect the real scripts, while the existing Node suite protects application behavior.

**Tech Stack:** Windows PowerShell 5.1+, Node.js 24+, npm, Vite, Node HTTP/SQLite server

**Spec:** `docs/superpowers/specs/2026-11-20-production-installer-design.md`

## Global Constraints

- Production mode only at `http://127.0.0.1:4317`.
- Never delete or overwrite `.data`.
- Do not download Node.js or expose the server publicly.
- Interactive choices must also have command-line equivalents for automation and tests.

## Review Focus

- Node.js missing or older than 24 must stop before npm/build actions.
- Paths containing spaces must remain correctly quoted.
- An existing `.data/study.sqlite` must survive install and build unchanged.
- A malformed or rejected backup must leave current records intact and report failure.
- Port 4317 already occupied must produce a useful launch result rather than another server crash.

---

### Task 1: Installer and launcher contract

**Files:**
- Create: `tests/installer.test.mjs`
- Create: `install.ps1`
- Create: `start-app.ps1`

**Interfaces:**
- Produces: `install.ps1` interactive prompts plus `-NonInteractive`, `-DryRun`, and explicit choice switches.
- Produces: `start-app.ps1` with `-OpenBrowser` and `-CheckOnly`.

- [ ] Write tests that require production-only commands, safe `.data` handling, Node 24 validation, interactive prompts, shortcut support, backup restore, and launcher port/build checks.
- [ ] Run `node --test tests/installer.test.mjs` and verify failure because the scripts do not exist.
- [ ] Implement the smallest PowerShell scripts that satisfy the contract.
- [ ] Run `node --test tests/installer.test.mjs` and verify all installer tests pass.
- [ ] Run `npm.cmd test` and verify the complete suite passes.
- [ ] Commit the scripts and tests.

### Task 2: Friend-facing documentation

**Files:**
- Modify: `README.md`
- Test: `tests/installer.test.mjs`

**Interfaces:**
- Consumes: root-level installer and launcher from Task 1.
- Produces: copy-paste production installation and launch instructions.

- [ ] Extend the failing installer test to require production installation, reinstallation/data preservation, backup restore, shortcut, and launch documentation.
- [ ] Run the installer test and verify the documentation assertion fails.
- [ ] Update `README.md` with the production workflow and troubleshooting.
- [ ] Run the installer test, complete suite, production build, and dry-run installer.
- [ ] Commit the documentation.
