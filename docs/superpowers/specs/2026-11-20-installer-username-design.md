# Installer Username Prompt Design

## Intent

Make each local installation personal from the first launch by asking for the dashboard display name during installation.

## Behavior

- Interactive first install requires a non-empty name of at most 40 characters.
- Interactive reinstall accepts a blank response and keeps the existing SQLite setting.
- `-UserName "Name"` supplies the value for non-interactive installation.
- A supplied name is applied after backup restoration, so the installing user wins over backup profile data.
- The installer updates the name through the existing local `/api/settings` endpoint; it does not edit SQLite directly.
- Dry-run mode reports whether the name will be changed without exposing or mutating other study data.

## Safety

The change keeps `.data` intact, preserves the current name when no replacement is supplied, rejects whitespace-only or overlong names, and uses only the loopback production server.
