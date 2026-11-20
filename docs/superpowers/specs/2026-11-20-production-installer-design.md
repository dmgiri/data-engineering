# Production Installer Design

## Intent

Make the downloaded or cloned Windows project straightforward for a friend to install and run locally in production mode. The installer must be interactive, preserve local study data, and avoid exposing the application to the network.

## Goals

- Provide double-clickable root-level `install.cmd` and `start-app.cmd` entry points, backed by focused PowerShell implementation scripts.
- Require Windows PowerShell and Node.js 24 or newer, with clear corrective errors.
- Ask whether to install dependencies, restore a JSON backup, create a desktop shortcut, start the app, and open it in the default browser.
- Install dependencies, create the production build, and keep the server bound to `127.0.0.1:4317`.
- Preserve `.data` during installation and updates.
- Support a non-interactive dry run so installer decisions and safety rules can be regression-tested without changing the machine.

## Non-goals

- No development server, custom ports, public hosting, service installation, auto-start, or Node.js auto-download.
- No copying SQLite files while the server is running.
- No overwrite or deletion of `.data`.

## Approach

Use CMD entry points because they can be double-clicked without changing PowerShell execution policy. They invoke native PowerShell implementation scripts with a process-scoped bypass. A Node-based installer would still need a working Node runtime before it could explain that Node is missing; a packaged Windows installer would add release/signing overhead that is unnecessary for a local tool.

`install.ps1` resolves all paths relative to itself, validates prerequisites, gathers choices with `Read-Host`, runs `npm.cmd install` and `npm.cmd run build`, optionally creates a `.lnk` shortcut, and optionally launches `start-app.ps1`. Backup restoration starts the production server temporarily when necessary and sends the selected JSON to the existing validated local import API. `start-app.ps1` validates the build, refuses to compete with another listener unless that listener is the working app, opens the browser only when requested, and runs `npm.cmd run serve` in the foreground so Ctrl+C stops it cleanly.

## Safety

- Existing `.data` is never deleted, reset, moved, or overwritten.
- Backup restoration uses the application API, which validates and applies restores transactionally.
- All commands run from the repository root and all HTTP checks target loopback only.
- A failed dependency install, build, shortcut creation, restore, or launch exits with a useful message.
