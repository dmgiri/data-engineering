# Engineer Prep

A local interview-preparation platform for senior data engineers. It includes SQL, PostgreSQL, Python, PySpark, Databricks, and data architecture questions, detailed answers, a 30-day study plan, progress tracking, and OneNote-style notes.

## Install on Windows

Requirements: **Windows** and **Node.js 24 or newer**.

1. Download or clone this repository.
2. Double-click `install.cmd`.
3. Enter the dashboard name at the username prompt.
4. Choose whether to restore a backup, create a desktop shortcut, and start the app.

The production app opens at <http://127.0.0.1:4317>. Keep its command window open while using it. Launch it later with the **Engineer Prep** desktop shortcut or `start-app.cmd`.

For unattended installation:

```bat
install.cmd -NonInteractive -UserName "Dipak"
```

Running the installer again updates and rebuilds the app while preserving `.data`, including questions, notes, settings, and progress. To move an existing installation, choose **restore backup** when prompted.

See [INSTALLATION.md](INSTALLATION.md) for first-time setup, updates, backup transfer, and troubleshooting.

## Features

- 875 questions and answers across six data-engineering subjects.
- Topic, subtopic, saved-only, and full-text filters.
- Q&A pagination with 20 questions per page, numbered pages, and Previous/Next controls.
- Full answers, explanations, examples, code, and reference links.
- A tracked 30-day plan with 302 study-material checkpoints.
- Bookmarks, studied-question records, study-time tracking, and progress reports.
- OneNote-style sections, pages, freeform text, links, photos, tables, and code blocks.
- Responsive light/dark interface with reduced-motion support.
- Local SQLite storage with JSON backup and restore.

## Use

Open **Questions** to search or filter the library. Changing a filter returns pagination to page 1. Open a question to read its complete answer, bookmark it, or mark it studied.

Use **Study plan** for daily targets, **Study material** for the 30-day workbook, **Progress** for completed work and recorded time, and **My Notes** for freeform notes.

Export or restore a JSON backup from **Settings**.

## Development

```powershell
npm.cmd install
npm.cmd run dev
```

The development UI runs at <http://127.0.0.1:5173>; the local API uses port 4317.

## Verify

```powershell
npm.cmd test
npm.cmd run build
node scripts/browser-qa.mjs
```

Browser QA requires Google Chrome. Test screenshots and results are written to `artifacts/`.
