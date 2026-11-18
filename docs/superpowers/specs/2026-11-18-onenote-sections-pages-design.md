# OneNote-style sections, pages, and mixed-content editor

## Intent

Turn My Notes into a simple local study notebook where material is organized as sections and pages and each page can mix written notes, links, photos, and tables. The hierarchy should feel familiar to OneNote without adding account, sharing, or cloud complexity.

## Goals

- Add persistent notebook sections and nested pages.
- Let every section expand or collapse independently.
- Keep existing notes by placing them in a default `My Notes` section during migration.
- Add, rename, and delete sections; add and delete pages.
- Retain the current block editor and add editable table blocks.
- Store hierarchy, blocks, ordering, and collapsed state in SQLite and backups.
- Keep the interface readable and responsive, including keyboard labels and reduced-motion behavior.

## Non-goals

- No free-positioned infinite canvas, handwriting, drawing, collaboration, or cloud sync.
- No arbitrary HTML embeds or unsafe file types.
- No deployment.

## Approach

Use a normalized `note_sections` table and add `sectionId` plus `sort_order` to `notes`. This is preferred over embedding the entire notebook tree in JSON because it preserves existing page records, makes migration and validation explicit, and supports later ordering changes. A single JSON notebook document was rejected because one malformed write could replace the entire notebook.

The React view will use a compact left notebook tree with collapsible section headers and nested page rows, plus the existing editor on the right. Mobile uses the same hierarchy above the editor instead of introducing a second navigation system.

## Data behavior

- A fresh database gets one `My Notes` section.
- Existing notes without a section are migrated into `My Notes` with stable ordering.
- A page belongs to exactly one known section.
- Deleting a non-empty section requires explicit confirmation and deletes its pages in the same transaction.
- Backups include `noteSections`; legacy backups without it restore pages into `My Notes`.
- Table blocks contain 1–20 rows and 1–10 columns, with cells limited to 2,000 characters.

## Interaction and motion

- Section chevrons and `aria-expanded` communicate collapsed state.
- Expand/collapse uses a short opacity/transform transition; no animated height or width.
- Page and section actions are real buttons with visible focus states.
- Reduced-motion mode removes decorative transitions.
