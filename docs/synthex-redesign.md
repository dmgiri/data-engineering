# Reference-led study dashboard

Reference: https://dribbble.com/shots/27131881-Synthex-UI-Analytics-SaaS-Dashboard by Jack R. / RonDesignLab.

The new link replaces the previous room-wallpaper direction. Implement the application shown within the reference, not the physical monitor, tilt, or browser chrome in its presentation image. Preserve React, Redux, Framer Motion, all question/answer content, and the SQLite API/data.

One coherent stylesheet replaces the old base/spatial/readability cascade. Use a mint/slate gradient canvas, a full-width text sidebar, rounded low-border panels, a navy accent, and Manrope typography with readable 14–16px content. No wallpaper or inactive floating dock. An active timer stays compact and dismissible through the existing finish flow. Light appearance matches the reference; dark appearance uses the same structure and hierarchy.

Overview hierarchy: title and plan dates; three actual-progress summaries; one study-activity panel with real 7/30-day data and subject filtering; today's assigned questions; subject coverage. Do not fabricate performance trends to fill the charts. Keep empty-state axes and useful next actions.

Implementation: test date/subject aggregation; replace the overview and application shell; replace the CSS with shared tokens and responsive layouts; run backend/build/browser tests; inspect overview, question reading, and mobile screenshots. Focus, save/retry behavior, and SQLite records must remain intact. No deployment.

Motion remains 140ms input feedback and 180ms view opacity, without decorative loops. Reduced motion removes transitions. Avoid animated width/position on the timer so it cannot cover reading text or lose centering.
