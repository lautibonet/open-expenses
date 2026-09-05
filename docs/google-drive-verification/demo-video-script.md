# Demo Video Script (drive.file Verification)

A shot-by-shot script for the unlisted YouTube video Google requires with the sensitive-scope verification request (issue #135). Requirements Google checks: in English, no cuts hiding the consent flow, show every step including the consent screen and the scope requested, and show the app doing what the justification says it does. Total length 2–3 minutes.

Recording setup: screen recorder at 1080p or higher, a Google account that is not on the app's test-users list, a clean browser profile (the "unverified app" screen can be skipped if brand verification is already approved; if it appears, leave it in, it helps reviewers see the flow), the app loaded from `https://openexpenses.app`.

Upload: YouTube, **Unlisted**, title "Open Expenses — Google Drive drive.file scope verification". Paste the link in the verification form.

---

## 1. Intro (0:00–0:15)

On screen: the Open Expenses landing page at `https://openexpenses.app`.

Voiceover:

> This is Open Expenses, a personal expense tracking web app. It has no backend. Your data lives in your browser, and it can save a backup to your own Google Drive. This video shows exactly how the app uses the `drive.file` scope, for Google's sensitive-scope verification.

## 2. The feature, from the user's side (0:15–0:45)

On screen: open the app (click the landing call to action, complete onboarding quickly or use an already-onboarded profile), then open the sidebar Backup action or Settings backup card.

Voiceover:

> The user starts a backup from the sidebar Backup button. There is no automatic backup; the user always starts it. The backup method is Google Drive, and the app is connected from here.

## 3. The consent flow (0:45–1:20)

On screen: click "Connect Google" (or start the first backup while disconnected). Keep the Google popup in frame the whole time. Do not cut here.

Voiceover:

> The app uses Google Identity Services' token client, the implicit flow, so the access token stays in the browser and no refresh token is ever requested. Here is the consent screen. The app requests exactly one scope: `https://www.googleapis.com/auth/drive.file`. That scope means the app can only see and manage files it created itself. Point out the scope text on screen. The user approves.

## 4. The backup (1:20–1:50)

On screen: run the backup, show the "last backed up" confirmation. Then open Drive in a second tab: show the "Open Expenses" folder at the Drive root, and inside it exactly one file, `open-expenses-backup.json`. Open the file preview to show it is the expense backup.

Voiceover:

> The backup writes one file, `open-expenses-backup.json`, into one folder, "Open Expenses". The app creates both if they do not exist. Nothing else in the Drive is read, listed, or changed.

## 5. The restore (1:50–2:20)

On screen: back in the app, run Restore from Google Drive (or restore on a second device / incognito profile) and show the data reappearing.

Voiceover:

> Restore downloads that same file and overwrites the local data. Again, the only file involved is the app's own backup file.

## 6. Scope boundary demonstration (2:20–2:45)

On screen: optional but strongly recommended for reviewers. In the Drive tab, show a personal folder or file that is NOT in the "Open Expenses" folder. Note there is no way the app can reach it: with `drive.file`, files.list queries return only app-created files.

Voiceover:

> To summarize: one scope, `drive.file`; one folder the app created; one file inside it; short-lived token, no refresh token, no backend. Anything outside the "Open Expenses" folder is invisible to the app.

---

## Recording checklist

- [ ] English voiceover (or clear English on-screen captions throughout)
- [ ] The consent screen shown fully, without cuts, with the `drive.file` scope visible
- [ ] The token flow shown as the GIS popup (no network inspector needed, but a brief view of the request showing `scope=https://www.googleapis.com/auth/drive.file` is a nice extra)
- [ ] The "Open Expenses" folder and `open-expenses-backup.json` shown in Drive
- [ ] Restore shown working
- [ ] Uploaded as **Unlisted**, link pasted into the verification form
