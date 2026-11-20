# Empty note container cleanup

## Intent

Keep OneNote-style click-anywhere typing without accumulating blank text fields. A blank canvas click may create a temporary focused editor, but an editor containing only whitespace is removed when abandoned and is never saved to SQLite.

## Approaches

- Selected: temporary click-created containers. They become real page content only after the user types non-whitespace text. This preserves click-anywhere editing and avoids false unsaved changes.
- Rejected: disable blank-canvas creation and require the Text ribbon button. This conflicts with the requested OneNote interaction.
- Rejected: keep empty containers in the draft and strip only during save. Empty fields would remain visible and still trigger unnecessary unsaved-change prompts.

## Behavior

- Clicking blank canvas creates and focuses a temporary text container at that position.
- Leaving it blank and clicking elsewhere removes it.
- Whitespace-only containers are excluded from save as a final safeguard.
- Typing non-whitespace content promotes the temporary container to normal content and marks the page dirty.
- Existing text, links, images, tables, code, drag, resize, and layering behavior remain unchanged.
