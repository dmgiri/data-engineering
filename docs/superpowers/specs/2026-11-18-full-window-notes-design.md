# Full-window Notes Design

## Intent

Make **My notes** a focused, full-browser-window notebook like the supplied OneNote reference. The learner should be able to organize pages by colored section and build a page from text, URLs, photos, tables, and code snippets without seeing the surrounding study-portal shell.

## Goals

- Hide the portal sidebar, top bar, outer padding, rounded shell, and background while Notes is open.
- Keep the existing three-pane notebook: colored sections, pages, and the editing canvas.
- Add a persistent code-snippet block with a language selector and monospace editor.
- Preserve existing text, link, image, and table blocks and all current SQLite data.
- Provide a clear **Exit notes** control that returns to the study desk.
- Remain usable on desktop, tablet, mobile, light theme, and dark theme.

## Non-goals

- Browser Fullscreen API, cloud synchronization, collaboration, drawing, handwriting, or arbitrary floating objects.
- Replacing the current block editor with a third-party rich-text editor.
- Deployment or changes to non-Notes screens.

## Approach

Use the existing `data-screen="notes"` state to apply the same local full-window shell override already proven by Study Material. This is preferable to the browser Fullscreen API because it works without permission prompts and keeps normal browser controls. A modal overlay was rejected because it would duplicate navigation and focus management.

Extend the existing note-block union with `{id, type:'code', language, code}`. SQLite continues storing blocks as validated JSON, so no table migration is required. Supported languages are a fixed set: `sql`, `postgresql`, `python`, `pyspark`, `scala`, `json`, `bash`, and `text`.

## Interaction and layout

- Notes fills `100dvh` and `100vw`; its three panes reach the full available height.
- The section-pane header contains the notebook identity, pane-collapse control, and Exit notes action.
- Page creation, section colors, search, rename/delete, pane collapse, save/delete, and block reordering continue to work.
- The block toolbar offers Text, URL, Photo, Table, and Code.
- Code blocks provide a language select and a large monospace textarea. They persist through save, reload, backup, and restore.
- On narrow screens the existing stacked section/page/editor layout remains, with no horizontal document overflow.

## Validation and safety

- Code language must be one of the fixed supported values.
- Code content is plain text up to 100,000 characters and is never executed or rendered as HTML.
- Existing block validation and atomic note writes remain unchanged.
- Automated database and browser tests cover validation, persistence, full-window geometry, exit behavior, dark/light compatibility, and mobile containment.

