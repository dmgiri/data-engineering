# Horizontal Frosted UI Design

## Intent

Unify Engineer Prep around the approved light and neutral-dark visual references while giving the content-heavy Study Material and My Notes views more horizontal space.

## Goals

- Replace the persistent desktop sidebar with a shared horizontal top navigation.
- Keep page-specific navigation inside Study Material and My Notes, where it belongs.
- Restyle the dashboard as a focused preparation HUD with daily target, streak, progress, activity, readiness, and next-question content.
- Support the existing light and dark theme setting; dark mode must use charcoal and graphite rather than blue-tinted surfaces.
- Preserve responsive behavior, keyboard navigation, Redux state, SQLite persistence, and all existing feature flows.

## Non-goals

- No changes to the database schema, APIs, question content, study-material content, or note-block model.
- No deployment or external service integration.
- No replacement of Material or Notes functionality.

## Approaches

1. **Shared horizontal shell with view-specific inner navigation (selected).** The app header owns product navigation; Material retains its chapter tree and Notes retains section/page panes. This gives both workspaces maximum useful width without duplicating controls.
2. Keep a collapsible rail. This still consumes width and conflicts with the requested horizontal navigation.
3. Build separate shells for each feature. This would reproduce the visual inconsistency the redesign is meant to remove.

## Design

Desktop uses a compact brand row plus a horizontally scrollable navigation row. The utility area contains local-save state, search, theme, and export. Below it, each view uses the full app width. At tablet/mobile widths the navigation remains horizontal and scrollable; it does not become a drawer.

The dashboard uses data already present in the application to populate the approved visual hierarchy. Light mode uses icy white surfaces with restrained blue accents. Dark mode uses neutral charcoal/graphite surfaces and reserves blue for progress and actions. Material and Notes retain their current internal navigation and editors, with width calculations updated for the wider shell.

## Constraints

- Existing stored records must remain readable and writable.
- Navigation must expose an active state and be keyboard accessible.
- No horizontal page overflow at common mobile widths.
- Motion must continue to respect reduced-motion preferences.

