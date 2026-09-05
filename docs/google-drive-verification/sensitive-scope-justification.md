# drive.file Sensitive-Scope Verification Justification

Text to paste into Google's sensitive-scope verification form (Data access page → `https://www.googleapis.com/auth/drive.file` → verification request). Written for issue #135; submit it together with the demo video ([demo-video-script.md](demo-video-script.md)). Field names match the form's questions; adjust slightly if the form wording changes.

---

**App name**

Open Expenses

**Website / home page**

https://openexpenses.app

**Privacy policy URL**

https://openexpenses.app/privacy

**Support email**

contact@openexpenses.app

**Requested scopes**

- `https://www.googleapis.com/auth/drive.file`

**Why does your app request this scope?**

Open Expenses is a personal expense tracking app (a static web app with no backend). The user's data lives in their browser's local storage. The app requests `https://www.googleapis.com/auth/drive.file` for one purpose only: to let the user save a backup of their own data as a single JSON file in their own Google Drive, and to restore it later, for example on a new device.

**How does the app use this scope? Describe every API call.**

The scope is used exclusively for Drive API v3 calls operating on files the app itself created:

1. `files.list` with `q` filtering, to search for an app-created folder named "Open Expenses" at the Drive root (filtering on `name`, `mimeType`, `parents`, and `trashed`), and within it for a file named `open-expenses-backup.json` (filtering on `name`, `parents`, and `trashed`). The queries target only app-created names, so the app never enumerates the user's other files.
2. `files.create` to create the "Open Expenses" folder at the Drive root, when it does not exist yet (metadata only, `mimeType=application/vnd.google-apps.folder`).
3. `files.create` (multipart upload) to create `open-expenses-backup.json` inside the "Open Expenses" folder, when no backup file exists yet.
4. `files.update` (multipart upload) to overwrite that same file on subsequent backups.
5. `files.get` with `alt=media` to download `open-expenses-backup.json` when the user restores a backup.

Because the scope is `drive.file`, the app can only see and touch the files it created itself: the "Open Expenses" folder and the single backup file inside it. It cannot read, list, search, or modify any other file in the user's Drive, and the video demonstrates this.

**How does the app comply with the Limited Use requirements?**

- The app does not transfer user data from Google APIs to any third party. There is no backend, no analytics, no advertising, no data sale. The only parties holding the data are the user's browser and the user's own Google Drive.
- The app does not transfer user data to AI models: it has no server component at all and never sends Drive data anywhere except back and forth with the Drive API on the user's behalf.
- The app does not use user data from Google APIs for advertising, for training any model, or for any purpose other than the backup and restore described above, which is the app's single human-visible feature that uses Drive.
- Compliance with the human-review requirements: the app uses the Drive API only to serve the user's own immediate backup/restore action, and its handling of Drive data is disclosed in the privacy policy at the URL above.

**What data does the app store, and where?**

The app stores the user's expense data only in the user's own browser (IndexedDB/local storage). The Drive access token obtained via Google Identity Services is held in browser local storage and expires within about an hour; no refresh token is requested or stored (implicit flow), so the app cannot access Drive except while the user is actively interacting with it. When the user starts a backup, the data is written to the user's own Drive and nowhere else.

**How can the user revoke access?**

At any time, from their Google Account (Security → Third-party apps with account access). This is stated on the privacy policy page. The app also has a Disconnect button that revokes the token via the OAuth revocation endpoint and clears it from the browser.

**Estimated usage**

Small scale: a personal app launching publicly, expected in the low thousands of users at most, each writing at most a few kilobytes to their own Drive.

**Demo video**

Unlisted YouTube link showing the full consent flow and each API call described above, as required: [demo-video-script.md](demo-video-script.md).

---

## Submission checklist

- [ ] Privacy policy reachable at `https://openexpenses.app/privacy` (deployed to the apex domain first)
- [ ] Branding verified (Search Console domain ownership) before submitting
- [ ] Video recorded per the script, uploaded unlisted, in English, and linked in the form
- [ ] Only `drive.file` listed as a requested scope
