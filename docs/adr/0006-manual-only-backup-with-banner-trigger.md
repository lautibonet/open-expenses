# Manual-only, optional backup with a banner trigger

Backup is an optional, user-initiated feature — never an automatic or mandatory part of the app. The user starts a cloud backup by tapping the always-present backup banner, which shows the backup method (Google Drive today; Dropbox, iCloud, etc. later) and the last backup time. The Settings Backup card provides download-backup-file, restore-from-file (upload), and restore-from-cloud.

This inverts an earlier draft that made Google Drive connection mandatory for onboarding and backed up automatically (on change and on visibility-hide). That approach conflicted with the app's core aim — a lightweight, ready-to-use PWA — because GIS cannot silently re-authenticate on every launch client-side without either a refresh token (an XSS exposure the project deliberately avoids per ADR 0004) or a popup per session. Manual-only keeps the app usable offline with no extra auth burden, while a single at-hand trigger makes backup convenient.

Restore — from cloud or from an uploaded file — always overwrites the full local dataset and never itself triggers a new backup. Providers are modeled behind a shared seam (folder-per-provider plus sync/download/upload), with Drive as the first implementation.
