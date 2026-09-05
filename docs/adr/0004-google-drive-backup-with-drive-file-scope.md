# Google Drive backup with drive.file scope

Backup uses Google Identity Services (GIS) with the OAuth 2.0 implicit flow (`google.accounts.oauth2.initTokenClient`, a public client, no secret). The browser receives a short-lived access token directly; no refresh token is ever held, no authorization code is exchanged, and there is no PKCE. The scope is `drive.file` only — the app can see and manage only files it created itself, never the user's broader Drive.

This was chosen because it gives off-device backup with zero server infrastructure, while the `drive.file` scope is the most restrictive permission that still allows the feature to work. The alternative (a custom backend with its own storage) would add hosting cost and auth complexity for a feature that is optional and secondary to the app's core purpose.

Restore is a full-dataset JSON snapshot overwrite, not incremental sync. This matches the mono-user, single-active-device usage pattern.

Amended (#135): the flow was originally described as Authorization Code with PKCE; the shipped implementation uses the GIS token client's implicit flow. The text above now matches the code; the scope decision is unchanged.
