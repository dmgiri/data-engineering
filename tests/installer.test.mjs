import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = resolve('.');
const installerPath = join(root, 'install.ps1');
const launcherPath = join(root, 'start-app.ps1');
const powershell = process.env.SystemRoot
  ? join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  : 'powershell.exe';

function readScript(filename) {
  return readFileSync(join(root, filename), 'utf8');
}

function runScript(filename, args, cwd = root, input) {
  return spawnSync(powershell, ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', filename, ...args], {
    cwd,
    encoding: 'utf8',
    input,
    timeout: 20_000
  });
}

function makeProject({ existingData = true } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'Engineer Prep installer '));
  mkdirSync(join(directory, '.data'), { recursive: true });
  mkdirSync(join(directory, 'build'), { recursive: true });
  if (existingData) writeFileSync(join(directory, '.data', 'study.sqlite'), 'existing-study-data');
  writeFileSync(join(directory, 'build', 'index.html'), '<!doctype html>');
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ scripts: { build: 'vite build', serve: 'node server/index.mjs' } }));
  copyFileSync(installerPath, join(directory, 'install.ps1'));
  copyFileSync(launcherPath, join(directory, 'start-app.ps1'));
  return directory;
}

test('production installer exposes interactive choices and never selects development mode', () => {
  const source = readScript('install.ps1');
  assert.match(source, /Read-Host/);
  assert.match(source, /Install dependencies/i);
  assert.match(source, /Restore.*backup/i);
  assert.match(source, /desktop shortcut/i);
  assert.match(source, /Start.*application/i);
  assert.match(source, /Open.*browser/i);
  assert.match(source, /npm\.cmd.*run.*build|NpmCommand.*run.*build/is);
  assert.doesNotMatch(source, /npm(?:\.cmd)?\s+(?:run\s+)?dev/i);
  assert.doesNotMatch(source, /Remove-Item[^\r\n]*\.data/i);
});

test('dry run resolves paths containing spaces and preserves existing SQLite data', () => {
  const directory = makeProject();
  const database = join(directory, '.data', 'study.sqlite');
  const result = runScript(join(directory, 'install.ps1'), [
    '-NonInteractive', '-DryRun',
    '-InstallDependencies', 'Yes',
    '-CreateDesktopShortcut', 'Yes',
    '-StartAfterInstall', 'No',
    '-OpenBrowser', 'No'
  ], directory);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /PRODUCTION INSTALLATION PLAN/i);
  assert.match(result.stdout, /npm\.cmd install/i);
  assert.match(result.stdout, /npm\.cmd run build/i);
  assert.match(result.stdout, /desktop shortcut/i);
  assert.equal(readFileSync(database, 'utf8'), 'existing-study-data');
});

test('installer rejects Node versions older than 24 before installation actions', () => {
  const directory = makeProject();
  const fakeNode = join(directory, 'old-node.cmd');
  writeFileSync(fakeNode, '@echo v23.9.0\r\n');
  const result = runScript(join(directory, 'install.ps1'), [
    '-NonInteractive', '-DryRun', '-NodeCommand', fakeNode,
    '-InstallDependencies', 'No', '-StartAfterInstall', 'No'
  ], directory);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /Node\.js 24 or newer is required/i);
  assert.doesNotMatch(result.stdout, /npm\.cmd install/i);
});

test('installer explains how to recover when Node is missing', () => {
  const directory = makeProject();
  const missingNode = join(directory, 'missing-node.exe');
  const result = runScript(join(directory, 'install.ps1'), [
    '-NonInteractive', '-DryRun', '-NodeCommand', missingNode,
    '-InstallDependencies', 'No', '-StartAfterInstall', 'No'
  ], directory);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /Node\.js 24 or newer is required.*nodejs\.org/is);
});

test('backup restoration is selected explicitly and remains non-mutating during dry run', () => {
  const directory = makeProject();
  const backup = join(directory, 'my backup.json');
  writeFileSync(backup, JSON.stringify({ version: 3 }));
  const result = runScript(join(directory, 'install.ps1'), [
    '-NonInteractive', '-DryRun',
    '-InstallDependencies', 'No',
    '-RestoreBackupPath', backup,
    '-CreateDesktopShortcut', 'No',
    '-StartAfterInstall', 'No'
  ], directory);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Restore backup/i);
  assert.match(result.stdout, /my backup\.json/i);
  assert.equal(readFileSync(join(directory, '.data', 'study.sqlite'), 'utf8'), 'existing-study-data');
});

test('production launcher validates a built app without starting a server', () => {
  const directory = makeProject();
  const result = runScript(join(directory, 'start-app.ps1'), ['-CheckOnly'], directory);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /ready/i);
  const source = readFileSync(join(directory, 'start-app.ps1'), 'utf8');
  assert.match(source, /127\.0\.0\.1:4317/);
  assert.match(source, /npm\.cmd.*run.*serve|NpmCommand.*run.*serve/is);
  assert.doesNotMatch(source, /5173|run\s+dev/i);
});

test('README explains production installation, safe updates, backups, shortcuts and launching', () => {
  const readme = readScript('README.md');
  assert.match(readme, /install\.cmd/i);
  assert.match(readme, /Node\.js 24/i);
  assert.match(readme, /production/i);
  assert.match(readme, /preserv(?:e|es|ed|ing)[^\n]*\.data/i);
  assert.match(readme, /restore[^\n]*backup/i);
  assert.match(readme, /desktop shortcut/i);
  assert.match(readme, /start-app\.cmd/i);
  assert.match(readme, /127\.0\.0\.1:4317/);
});

test('CMD entry points launch the production installer and application from any working directory', () => {
  const installer = readScript('install.cmd');
  const launcher = readScript('start-app.cmd');
  assert.match(installer, /%~dp0install\.ps1/i);
  assert.match(installer, /ExecutionPolicy\s+Bypass/i);
  assert.match(installer, /%\*/);
  assert.match(launcher, /%~dp0start-app\.ps1/i);
  assert.match(launcher, /ExecutionPolicy\s+Bypass/i);
  assert.match(launcher, /%\*/);
  assert.doesNotMatch(`${installer}\n${launcher}`, /run\s+dev|5173/i);
});

test('first installation requires a username and includes it in the production plan', () => {
  const directory = makeProject({ existingData: false });
  const result = runScript(join(directory, 'install.ps1'), ['-DryRun'], directory, [
    '', 'Asha', 'n', 'n', 'n', 'n'
  ].join('\r\n') + '\r\n');
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Enter your name/i);
  assert.match(result.stdout, /User name:\s*Asha/i);
});

test('reinstallation can keep the existing username with a blank response', () => {
  const directory = makeProject();
  const result = runScript(join(directory, 'install.ps1'), ['-DryRun'], directory, [
    '', 'n', 'n', 'n', 'n'
  ].join('\r\n') + '\r\n');
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /leave blank to keep/i);
  assert.match(result.stdout, /User name:\s*keep existing/i);
});

test('non-interactive username is trimmed and rejects values over 40 characters', () => {
  const directory = makeProject();
  const accepted = runScript(join(directory, 'install.ps1'), [
    '-NonInteractive', '-DryRun', '-UserName', '  Priya  ',
    '-InstallDependencies', 'No', '-StartAfterInstall', 'No'
  ], directory);
  assert.equal(accepted.status, 0, accepted.stderr || accepted.stdout);
  assert.match(accepted.stdout, /User name:\s*Priya/i);

  const rejected = runScript(join(directory, 'install.ps1'), [
    '-NonInteractive', '-DryRun', '-UserName', 'x'.repeat(41),
    '-InstallDependencies', 'No', '-StartAfterInstall', 'No'
  ], directory);
  assert.notEqual(rejected.status, 0);
  assert.match(`${rejected.stdout}\n${rejected.stderr}`, /40 characters or\s+fewer/i);
});

test('installer persists a supplied username through the local settings API after restore', () => {
  const source = readScript('install.ps1');
  assert.match(source, /UserName/);
  assert.match(source, /api\/settings/i);
  assert.match(source, /ConvertTo-Json/);
  assert.ok(source.indexOf('Restore-StudyBackup') < source.lastIndexOf('Set-StudyUserName'));
  const readme = readScript('README.md');
  assert.match(readme, /ask[^\n]*name|name[^\n]*prompt/i);
  assert.match(readme, /-UserName/i);
});
