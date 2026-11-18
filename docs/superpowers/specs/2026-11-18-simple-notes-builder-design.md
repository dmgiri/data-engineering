# Simple Notes Builder Design

## Intent

Add a local, OneNote-inspired **My Notes** workspace to Engineer Prep so study notes, useful links, and reference images can be kept beside the existing interview material.

## Scope

- A dedicated `#notes` workspace with a searchable note list and a single-page editor.
- Notes have a title and ordered blocks of three types: text, link, and image.
- Users can create, edit, remove, and reorder blocks; save or delete notes.
- Images are pasted/uploaded through a file control, limited to PNG, JPEG, WebP, or GIF and 2 MB each.
- Notes and image data remain in SQLite and are included in JSON backup/restore.
- The layout remains usable at 390 px and inherits light/dark mode.

## Approach

Use a small controlled React form rather than a full rich-text/canvas dependency. Store each note's validated block array as JSON in one additive SQLite `notes` table. Image blocks use validated data URLs so the local database and existing JSON backup remain self-contained.

## Non-goals

- No cloud synchronization, collaboration, handwriting, arbitrary floating canvas, document import, or nested notebooks.
- No deployment.

## Safety and durability

- Accept only `http:` and `https:` links.
- Reject SVG and non-image data URLs.
- Keep old SQLite files and legacy backups compatible.
- Preserve current notes when restoring an older backup that has no `notes` field.
