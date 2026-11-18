# Content-first study reader design

## Intent

Make the study material feel like technical documentation: the lesson is the product, while the course index and application chrome stay secondary. The structural reference is the current Databricks documentation site, not its branding.

## Goals

- Give the active lesson the majority of the viewport at desktop, tablet, and mobile widths.
- Replace the permanently visible 30-day index with an accessible course drawer.
- Keep a small contextual “On this day” rail on wide screens and hide it when space is limited.
- Preserve search, resources, previous/next navigation, completion, exact resume state, dark/light mode, and SQLite persistence.
- Keep code and tables horizontally contained without shrinking article text.

## Non-goals and anti-goals

- Do not copy Databricks trademarks, text, colors, or navigation labels.
- Do not change the workbook content, question catalog, API, or database schema.
- Do not make the index the dominant first screen or force mobile readers through a long chapter list before the lesson.

## Approach

The selected approach is a dedicated documentation mode inside the existing React application. When Study Material is active, the dashboard sidebar and general top bar are replaced by a compact reader bar. A fixed, closed-by-default course drawer contains all 30 days, search, and references. The main area uses a readable article column and a narrow contextual rail on large screens. A permanent two-column index was rejected because it repeats the current problem; a separate application was rejected because it would fragment routing, theming, and progress state.

## Responsive behavior

- Wide screens: article plus narrow “On this day” rail, centered within a bounded documentation canvas.
- Medium screens: article only; the contextual rail disappears and the course drawer remains available from the reader bar.
- Small screens: full-width article, compact sticky reader bar, drawer covering most of the viewport, large touch targets, and contained tables/code.

## Validation

Browser tests must prove that dashboard chrome is removed in material mode, the drawer is closed by default and operable, the article dominates the viewport, the contextual rail collapses at smaller widths, and no page overflow occurs. Existing content, progress, safety, resume, and mobile table tests remain mandatory.
