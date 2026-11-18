# Latest reference: course dashboard + direct Q&A

The user's latest attached Coursia dashboard image supersedes the Synthex link and older room image. Lavender page background; one large white rounded application frame; full white left sidebar; pale gray content area; purple-to-blue active controls; center study/course content; a separate right column with a two-week calendar and today's questions. Use the actual study data rather than fictional mentors, students, subscriptions, or courses. Native SVG/CSS subject covers are appropriate; do not generate bitmap art.

Keep React/Redux/Framer Motion, local-only servers, SQLite question library, and daily time records. The user explicitly wants questions and answers only, without "user thought": open each question with the full answer visible; remove reasoning drafts, reflection textareas, confidence ratings, and personal-note prompts from the active UI. Do not erase existing saved drafts or notes. A simple factual "Mark studied" action can track progress, without asserting confidence.

## Simple review API contract

Add `progress.reviews` to bootstrap: array `{id,date,questionId,createdAt}`. Add `POST /api/reviews` accepting the same shape, idempotent by ID. Store in an independent SQLite reviews table; retain all old tables and data. JSON backups include reviews and accept old v1 backups without reviews. No confidence value, answer text, or thought is required. The UI counts studied questions as the union of old attempts and new reviews.

## Visual and behavior verification

Desktop has a sidebar, main column, and right study rail. On mobile, content stacks at readable widths. Violet/blue buttons have 140ms hover/press feedback; view/disclosure transitions use 180ms opacity/short travel; reduced motion removes movement. Verify direct answer visibility, no personal-input form in study view, idempotent mark-studied persistence, calendar selection, filters, time logging, and light/dark appearance. Inspect screenshots before handoff. No deployment.
