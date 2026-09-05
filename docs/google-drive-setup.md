# Google Drive Backup Setup

The Google Drive backup uses Google Identity Services (GIS) with the OAuth 2.0 implicit flow to access a single file on the user's Google Drive. The GIS token client (`google.accounts.oauth2.initTokenClient`) obtains an access token directly in the browser — there is no authorization code exchange or PKCE. The client ID is stored in `src/index.html` as a meta tag. Follow these steps to configure it.

## Prerequisites

- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

## Steps

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top → **New Project**
3. Name it (e.g. "Open Expenses") → **Create**

### 2. Enable the Google Drive API

1. In the project, go to **APIs & Services** → **Library**
2. Search for "Google Drive API"
3. Click it → **Enable**

### 3. Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type → **Create**
3. Fill in:
   - **App name**: "Open Expenses" (or your preferred name)
   - **User support email**: your email
   - **Developer contact email**: your email
4. **Save and Continue**
5. On **Scopes** page: click **Add or Remove Scopes** → add `https://www.googleapis.com/auth/drive.file` → **Update** → **Save and Continue**
6. On **Test users** page: click **Add Users** → add your Google email → **Save and Continue**
7. **Back to Dashboard** — your app is now in "Testing" mode (works for test users only)

### 4. Create OAuth 2.0 Client ID

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: "Open Expenses Web"
5. Under **Authorized JavaScript origins**, add your app's origin:
   - For local dev: `http://localhost:4200` (or whatever port you use)
   - For production: `https://your-domain.com`
6. **Create** → copy the **Client ID**

### 5. Update the App

Replace the placeholder in `src/index.html`:

```html
<!-- Before -->
<meta name="google-client-id" content="YOUR_GOOGLE_CLIENT_ID">

<!-- After -->
<meta name="google-client-id" content="123456789-abc.apps.googleusercontent.com">
```

### 6. Test

1. Run the app locally
2. Go to **Settings** → **Google Drive** → **Connect Google**
3. The Google consent popup should appear without errors
4. Authorize → the app should show "Connected"

## Important Notes

- The app is in **Testing** mode by default. Only added test users can authorize. To allow anyone, you'd need to go through Google's verification process (not required for personal use).
- The app only requests `drive.file` scope — it can only access files it creates, not the user's entire Drive.
- The backup file is named `open-expenses-backup.json` and stored in the root of the user's Drive.
