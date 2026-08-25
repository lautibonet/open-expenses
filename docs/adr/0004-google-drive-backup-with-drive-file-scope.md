# Google Drive backup with drive.file scope

Backup uses OAuth 2.0 Authorization Code flow with PKCE via Google Identity Services (public client, no secret). The scope is `drive.file` only — the app can see and manage only files it created itself, never the user's broader Drive.

This was chosen because it gives off-device backup with zero server infrastructure, while the `drive.file` scope is the most restrictive permission that still allows the feature to work. The alternative (a custom backend with its own storage) would add hosting cost and auth complexity for a feature that is optional and secondary to the app's core purpose.

Restore is a full-dataset JSON snapshot overwrite, not incremental sync. This matches the mono-user, single-active-device usage pattern.
