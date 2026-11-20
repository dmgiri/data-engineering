# Question Library Pagination Design

## Intent

Keep the 875-question Q&A library readable and navigable without rendering one very long list.

## Behavior

- Show 20 filtered questions per page with global question numbering.
- Display the visible range and total, such as `Showing 21–40 of 875`.
- Provide Previous, Next, and compact numbered page controls with ellipses for long ranges.
- Reset to page 1 whenever subject, topic, subtopic, search, or Saved changes.
- Clamp the active page when a result-set change removes the last page.
- Keep controls keyboard accessible, mark the current page, and disable unavailable directions.
- Use a compact wrapping layout on phones.

## Approach

Use client-side pagination because the complete catalog is already loaded from SQLite for filtering and full-text search. A pure helper calculates the clamped slice and compact page-number window; `QuestionLibrary` owns only the current page state.
