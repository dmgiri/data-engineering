# OneNote Freeform Canvas Design

## Intent

Turn the Notes page into a true OneNote-style spatial canvas. A learner can click any blank point and immediately type there, then move and resize text, links, pictures, tables, and code without losing existing notebook data.

## Goals

- A primary click on blank canvas creates and focuses a text container at that exact canvas coordinate.
- Every block type is positioned, draggable, resizable, removable, and saved with the page.
- Ribbon insertion creates the selected block near the visible canvas area and focuses its first editable control.
- Existing ordered notes open with a deterministic vertical layout and acquire persisted coordinates on their next save.
- The canvas can grow beyond the viewport while the browser document itself remains contained on desktop and mobile.
- SQLite backups and restores preserve spatial layout.

## Non-goals

- Drawing, handwriting, ink recognition, collaboration, cloud sync, rotation, grouping, or overlapping-page print layout.
- Automatic saving or replacing the existing explicit Save action.
- Replacing the existing section/page navigation or block content editors.

## Approach

Each note block may carry `layout: {x, y, width, height, z}`. The server validates the optional object and preserves legacy blocks that do not yet contain it. The React editor hydrates missing layouts using type-aware default sizes and index-based vertical positions, so existing notes remain readable before any write.

The page content becomes a relative-positioned spatial layer inside the existing scrolling editor canvas. Blocks are absolutely positioned. Pointer-based drag and resize handles update the controlled draft; interactions are bounded to non-negative coordinates and minimum/maximum sizes. A blank-layer pointer click adds a text block at the translated canvas coordinate and focuses it. Interactive descendants stop canvas creation.

## Interaction rules

- Blank click: create a text item with its top-left near the click, bring it to front, and focus the textarea.
- Item click/focus: bring the item to front without creating another item.
- Drag handle: move the item; release commits the final draft position.
- Resize handle: resize with type-aware minimum dimensions.
- Ribbon insert: add at the last blank-click coordinate or the visible canvas origin plus an offset.
- Delete: remove the selected item; a page may keep zero blocks because a blank OneNote page is valid.
- Save: persist title, block content, and layouts atomically through the existing SQLite endpoint.

## Data and safety

- `x` and `y`: finite integers from `0` to `10000`.
- `width`: finite integer from `180` to `2000`.
- `height`: finite integer from `80` to `2000`.
- `z`: finite integer from `0` to `10000`.
- Malformed layout data rejects the whole note atomically.
- Existing block content validation, safe links, image limits, and code-language restrictions remain unchanged.

## Responsive behavior

Desktop uses a large scrollable spatial surface. Tablet and mobile keep page-level overflow contained inside the canvas viewport; the spatial surface remains pannable rather than collapsing coordinates into a different layout. Touch dragging and resizing use the same pointer events, while normal editing controls remain interactive.

## Verification

Database tests cover valid layouts, invalid bounds, legacy blocks, empty pages, backup, and reopen. Browser tests cover click-anywhere text creation, focus, drag, resize, reload persistence, existing-block migration, ribbon insertion, and 390 px containment.
