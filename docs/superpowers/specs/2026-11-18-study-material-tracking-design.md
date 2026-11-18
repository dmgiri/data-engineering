# Study Material Tracking Design

## Intent

Add the supplied `30_day_data_engineering_interview_prep(1).md` workbook to the existing local Engineer Prep portal as readable study material. The learner should be able to move through the 30-day material, mark each checkpoint complete, leave and return to the last-read section, and see completion reflected in the existing progress experience.

The document is source content only. Its text is never interpreted as application, agent, or build instructions.

## Goals

- Preserve the complete supplied workbook locally, including code, tables, lists, labs, worked solutions, and appendices.
- Present 30 day chapters with one briefing plus the workbook's headed sections (302 tracked checkpoints; Day 17 contains two additional pipeline setup sections).
- Persist completed checkpoints and the last-read position in `.data/study.sqlite`.
- Include material tracking in backup and restore without changing existing question, answer, session, or bookmark records.
- Match the current lavender course-dashboard UI, dark mode, responsive behavior, reduced-motion setting, and local-only architecture.

## Non-goals

- Do not convert workbook practice prompts into the Q&A library.
- Do not execute code or HTML found in the Markdown.
- Do not deploy or connect to a remote service.
- Do not require notes, reflections, confidence ratings, or personal author information.

## Constraints

- React, Redux Toolkit, Framer Motion, and the existing Node SQLite server remain the application stack.
- Use a Markdown renderer that escapes raw HTML by default and supports GitHub-style tables.
- The import must be deterministic and fence-aware so headings inside code blocks cannot alter the chapter structure.
- Existing SQLite rows and stable question IDs must remain untouched.

## Approaches considered

1. **Serve the original Markdown as one long page.** Minimal import work, but poor navigation and no meaningful checkpoint tracking.
2. **Convert every paragraph into a database record.** Fine-grained tracking, but noisy and fragile because editorial paragraph changes would rewrite progress identity.
3. **Import chapter and heading boundaries into SQLite.** Selected. The document already has stable day and section headings, giving useful tracking granularity while preserving the original Markdown within each section.

## Design

- Copy the unchanged source into `server/imports/30-day-data-engineering-interview-prep.md` and record its SHA-256 hash.
- Parse only recognized level-two day headings and level-three section headings while outside fenced code. Each day gains a stable `day-NN-briefing` section followed by its nine headed sections. Non-day level-two blocks become read-only reference chapters.
- Seed material, chapters, and sections with `INSERT OR IGNORE`. Persist completion separately in `material_progress` and resume position in `material_state`, so a catalog refresh cannot erase learning records.
- Return material content and tracking in bootstrap. Add local-only update routes for completion and resume position.
- Add a `Study material` navigation view with chapter search, grouped day navigation, section checklist, readable Markdown, completion meter, next-section navigation, and a resume affordance.
- Add the completed checkpoint count to Daily Progress and link a selected plan day directly to its matching material chapter.
- Backups remain version 1 with optional material fields, preserving compatibility with earlier backups.

## Success criteria

- The importer finds exactly 30 days and 302 tracked checkpoints from the supplied file.
- Completion and last-read position survive a new database connection, export/import, and browser refresh.
- Existing 875 Q&A records and prior progress remain unchanged.
- Tests, production build, and browser QA pass with no runtime exceptions.
