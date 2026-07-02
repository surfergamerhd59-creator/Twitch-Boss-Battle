---
name: Mod permission architecture
description: How moderator access to a streamer's channel is authorized across API routes
---

`canAccessChannel(streamerUsername, user)` in `channel-access.ts` (api-server) grants access if the requesting user IS the streamer, or is an active row in `authorizedModeratorsTable` for that streamer.

**Why:** Multiple users (streamer + their mods) can control one channel via the same route paths (`/stream/:username/...`). Mods authenticate with their own JWT but act on a `:username` route param that names the streamer's channel, not their own.

**How to apply:** Any new route that mutates or reads a specific streamer's channel state must call `canAccessChannel(username, req.twitchUser!)` and 403 if false — don't rely on `req.twitchUser.username === username` alone, that only covers the owner case.

**Known gap:** `moderation.ts` (ban/timeout/unban routes) does NOT have `requireAuth` middleware applied — pre-existing, `req.twitchUser` is `undefined` there. Not fixed as it wasn't in scope for prior sessions; flag it if touching that file.
