# Notes Clipboard Image Paste Design

## Intent

Make image capture in My Notes feel like OneNote: copy an image from another application, open a note, and press `Ctrl+V` or `Cmd+V` to place it on the page without using the Picture file picker.

## Behavior

- Handle clipboard images only when a note page is open.
- Prefer the first supported clipboard image (`PNG`, `JPEG`, `WebP`, or `GIF`).
- Create a populated image block, select it, and mark the page unsaved.
- Use the existing 2 MB image limit and notification behavior.
- Preserve native paste when focus is inside an input, textarea, select, link, or editable element so copied text and code continue to paste normally.
- Ignore clipboard events without supported image data and never create an empty block.
- Save pasted images through the existing Notes save flow.

## Placement

Place the image using the editor's normal automatic block layout. This is predictable across desktop and mobile and does not require tracking mouse position during a keyboard paste.

## Approaches

- **Selected: Notes-level paste event listener.** Works when the user is anywhere on an open note while preserving native paste in editable controls.
- Canvas-only listener: simpler, but fails when focus is on the title or ribbon and feels less like OneNote.
- Async Clipboard API button: requires extra browser permissions and does not provide direct `Ctrl+V` behavior.

## Constraints

- No new dependency.
- No automatic page creation when no page is open.
- Existing file-picker image insertion remains unchanged.
