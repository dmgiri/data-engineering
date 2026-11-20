# Installation guide

## Requirements

- Windows 10 or 11
- [Node.js 24 or newer](https://nodejs.org/)
- Google Chrome only if you want to run browser QA

Confirm Node.js is available:

```bat
node --version
npm --version
```

## First installation

1. Download or clone the repository.
2. Open the project folder.
3. Double-click `install.cmd`.
4. Enter the dashboard username when prompted.
5. Choose whether to install dependencies, restore a JSON backup, create a desktop shortcut, start the app, and open the browser.

The installer creates a production build and starts it at <http://127.0.0.1:4317>. The app is available only on your computer. Keep the server window open; press **Ctrl+C** there to stop it.

For an unattended installation:

```bat
install.cmd -NonInteractive -UserName "Asha"
```

## Start later

Use the **Engineer Prep** desktop shortcut or run:

```bat
start-app.cmd
```

## Update

Pull or copy the latest project files, then run `install.cmd` again. The installer updates dependencies and rebuilds the production app while preserving existing local records.

## Move to another computer

1. In the old app, open **Settings** and select **Export backup**.
2. Copy the downloaded JSON backup and this repository to the new computer.
3. Run `install.cmd` on the new computer.
4. Select the restore option and choose the JSON backup.

## Troubleshooting

- **Node.js is missing or too old:** install Node.js 24 or newer, reopen Command Prompt, and run `install.cmd` again.
- **Port 4317 is already in use:** stop the other Engineer Prep server or the program using that port.
- **The browser did not open:** visit <http://127.0.0.1:4317> manually.
- **The shortcut is missing:** run `install.cmd` again and choose the desktop-shortcut option.
- **Installation fails:** read the PowerShell error, confirm you started the installer inside the project folder, and retry.
