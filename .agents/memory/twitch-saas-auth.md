---
name: Twitch SaaS auth flow
description: How OAuth2 callback hands off a session token to the mobile app
---

## The rule
After `/api/auth/callback` exchanges the Twitch code for tokens and issues a JWT, it serves an HTML success page that:
1. Auto-tries `window.location.href = mobile://auth?token=<jwt>&username=...&displayName=...&twitchId=...` after 1 second.
2. Shows the JWT in a copyable text box (fallback for web/browsers that block custom schemes).

Mobile `AuthContext` listens with `Linking.addEventListener("url", ...)` and also checks `Linking.getInitialURL()` on mount.

Manual fallback: login screen has a "Paste session token" field that calls `GET /api/auth/me` to validate and then stores the token.

**Why:** Expo web previews and some Android browsers don't auto-fire custom-scheme deep links. The HTML page + manual paste ensures every environment works.

**How to apply:** Any time the OAuth callback needs to return data to the mobile app, use this same pattern — serve an HTML page, auto-try the deep link, show a copy-able code.

## Key constants
- Mobile scheme: `"mobile"` (set in `artifacts/mobile/app.json`)
- JWT signed with `SESSION_SECRET` env var, 30-day expiry
- JWT payload: `{ twitchId, username, displayName }`
- Mobile sends JWT as `Authorization: Bearer <token>` header
