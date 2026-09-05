# Root URL enters the app directly; the Landing moves to /landing

Previously the Landing (product pitch) was served at the root, so every launch — from the web and from the installed PWA (`start_url: "/"`) — forced users through it before reaching the app. Now the root URL enters the app directly: un-onboarded users are sent to Onboarding by the existing guard, and everyone else lands in the app. The Landing is served at `/landing`, a Public Page reached deliberately via the app footer and the Privacy page, making it the link to share when presenting the app. The app has no login, but onboarding state lives in IndexedDB, so the "is this user new?" check needs no auth.

## Considered Options

Showing the Landing only to first-time visitors (a local flag check at the root) was rejected: it duplicates the entry contract in a second place, and the first-run experience would depend on how the user first arrives. Wildcard/unknown paths keep falling through to the app rather than to the Landing: they are almost certainly stale deep links from returning users.
