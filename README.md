# Engineer Prep — local interview study app

React, Redux Toolkit, Framer Motion, Lucide icons, CSS Grid, and Node's built-in SQLite. Built for a data engineer with 7+ years of experience. No cloud account, AI service, or deployment is involved.

## Install on Windows

This installation runs the production application only. Install [Node.js 24 or newer](https://nodejs.org/), then download or clone this repository and open PowerShell inside its folder.

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

The installer asks whether to:

- install npm dependencies;
- restore an existing JSON backup;
- create an **Engineer Prep** desktop shortcut;
- start the application; and
- open it in your default browser.

The production application is available only on your computer at http://127.0.0.1:4317. Keep the server window open while studying and press Ctrl+C in that window to stop it. It is intentionally not exposed to your local network or the internet.

To launch it again later, use the desktop shortcut or run:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-app.ps1 -OpenBrowser
```

Running `install.ps1` again updates dependencies and rebuilds the application. Reinstallation preserves `.data`, including the SQLite database, notes, images, study progress, bookmarks, and settings. The installer never deletes `.data`.

To move records from another installation, export a JSON backup from **Settings → Export backup**, then choose the restore option when the installer prompts you. An invalid backup is rejected by the same transactional validation used inside the application, leaving the current database unchanged.

If installation stops, read the error shown in PowerShell. The most common causes are Node.js older than version 24, port 4317 being used by another program, or running the command outside the downloaded project folder. Node's SQLite experimental-feature notice is expected.

## Development

Contributors can run the Vite development server separately:

```powershell
npm.cmd install
npm.cmd run dev
```

Development uses http://127.0.0.1:5173 with the API on port 4317. Do not expose either server to a public network.

## Study workflow

- A 30-day plan rotates SQL, PostgreSQL, Python, PySpark, Databricks and Architecture. Every subject receives five days; every question is assigned once. The full library is a reference bank, not a promise that all 875 questions fit one month of the configured study time.
- Defaults: 60 minutes each weekday and 150 minutes per weekend day — five hours across Saturday and Sunday. Change targets and start date in Settings.
- 875 questions and answers: all 622 entries from the supplied Markdown collection plus the existing 253 questions. Existing answers and records are retained, not replaced.
- A complete learning platform is built from the supplied 30-day workbook: 30 day chapters, 302 trackable reading/lab checkpoints, worked solutions, code, tables, search, previous/next navigation, and the full reference appendix. This is structured course content inside the portal, not a file-download screen.
- Study Material remembers the last section you opened and stores every completed checkpoint in SQLite. The selected day in the 30-day plan opens the matching workbook chapter, and Daily progress shows the completed checkpoint count.
- The library shows all questions together. Combine subject, topic and subtopic filters, or search questions, answers, examples and imported IDs such as `SQL-001`, `PG-001` and `ARCH-104`. There is no candidate-reported restriction, source selector, origin badge or author panel.
- Imported answers, examples and follow-ups are preserved as supplied. Some answers are short; they have not been padded or presented as newly authored detailed explanations. The 73 supplied code examples stay separate from prose. Empty key-point sections are omitted. Compact official technical-reference links remain after the study content.
- Internal document/source metadata is retained for auditing and idempotent imports, but is not a learning filter or displayed verification commentary. The original Downloads file is unchanged; the app uses the local snapshot in `server/imports/linkedin-senior-de-622.md` and does not depend on Downloads at runtime.
- Open any question to read its full answer immediately. No thought box, written response, confidence rating, or reflection prompt is required.
- Mark as studied records factual completion in SQLite. Repeating an interrupted save does not duplicate the record, even after navigating away and reopening the question.
- Use bookmarks, subject/topic/search filters, previous/next navigation, and distraction-free focus reading.
- My Notes provides a simple local notebook. Each note can contain ordered text, safe web-link, and image blocks; blocks can be moved or removed. PNG, JPEG, WebP, and GIF images up to 2 MB are stored inside SQLite with the note.
- The timer survives same-tab reloads. Finish it to record actual minutes, or log time manually in Daily progress. Running or paused timers alone do not count as recorded time. The timer occupies its own space rather than overlaying answer text.
- A study day is complete only when its assigned questions are studied and its time target is recorded. Activity charts show actual logged time over the last 7 or 30 days. Empty records show zero, not sample activity.

## Library coverage

| Subject | Imported from the file | Total in SQLite |
| --- | ---: | ---: |
| SQL | 104 | 233 |
| PostgreSQL | 100 | 133 |
| Python | 101 | 130 |
| PySpark | 106 | 138 |
| Databricks | 107 | 137 |
| Architecture | 104 | 104 |
| Total | 622 | 875 |

The import preserves all 622 unique source IDs. Repeated restarts add no duplicate IDs, and no identical question-and-answer pairs were found within the supplied collection. Thematically overlapping study questions remain available rather than silently discarding entries. Document prose, HTML and example code are treated as inert study content, never executed as application or agent instructions. The import is not a full technical audit of every supplied answer. The app does not execute SQL, Python, Spark, Docker or Databricks workloads.

## Your data

The question text, answers, workbook chapters and sections, material completion, last-read position, notes and note images, settings, bookmarks, studied-question reviews, and study sessions are stored in `.data/study.sqlite`. Catalog rows are read from SQLite. Restarting adds new catalog IDs without overwriting existing rows or study records.

Settings → Export backup downloads versioned JSON records and preferences. Restore validates before changing the database and downloads a current backup first. Restoring retains the local question catalog. To copy the complete database, stop the app first and copy `.data/study.sqlite`; while running, SQLite can also have `-wal` and `-shm` files. Do not delete `.data` to update the app.

Existing legacy drafts, attempts, confidence values, and session notes are preserved for backup compatibility, but the current study interface does not request or display personal thought fields. Older v1 backups without studied-question reviews, material fields, or notes remain supported. Missing material fields preserve current workbook progress, and missing notes preserve the current local notebook. New exports include notes and image data.

Targets reflect active settings, including historical summaries. Changing the start date reschedules the plan without deleting records. Study dates consistently use Asia/Kolkata.

## Interface

The latest course-dashboard reference drives the lavender page background, rounded white frame/sidebar, pale gray canvas, purple-to-blue controls, activity panel, subject cards, and right-hand calendar/study rail. Subject illustrations are native CSS/SVG, with no generated imagery or runtime image requests. Manrope fonts are served locally with their included OFL license.

Light/dark themes, responsive layouts, keyboard search (Ctrl/Cmd+K), and focus mode are supported. The learning reader collapses to a single-column layout on phones, keeps code and tables horizontally contained, and uses readable long-form typography. Motion is limited to short view/answer transitions and hover/press feedback. The operating system's reduced-motion preference removes nonessential animation.

## Verification

```powershell
npm.cmd test
npm.cmd run build
node scripts/browser-qa.mjs
```

The browser script requires Google Chrome at its usual Windows path (or `CHROME_PATH`). It uses an isolated in-memory SQLite database and a temporary headless Chrome profile, not your real study database. Screenshots and results are written under `artifacts/`.

Production dependencies have no audit findings in the verified install (`npm audit --omit=dev`). A transitive `picomatch` ReDoS advisory remains in the Vite development dependency tree; `npm audit fix` reported no applicable update despite marking a fix available. Keep development servers loopback-only; use the built app on port 4317 when not developing.
