# Twitch Bot Control Panel

A multi-user SaaS mobile app (Expo) + Express API server for streamers to control their Twitch channel from a phone.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Mobile: Expo Router v6 (React Native)
- Build: esbuild (ESM output with CJS compat banner)
- Auth: Twitch OAuth2 + JWT (signed with `SESSION_SECRET`)

## Where things live

- `lib/db/src/schema/` — source of truth for DB tables (streamers, user_bans, banners, social_links)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/` — shared server utilities (twitch-api, twitch-bot-manager, logger)
- `artifacts/api-server/src/middlewares/requireAuth.ts` — JWT middleware
- `artifacts/mobile/app/(tabs)/` — 5 main screens (dashboard, boss, sounds, controls, perms)
- `artifacts/mobile/app/login.tsx` — Twitch login screen
- `artifacts/mobile/context/AuthContext.tsx` — global auth state + deep-link handler
- `artifacts/mobile/lib/api.ts` — all mobile API calls

## Architecture decisions

- **No Java** — stack is Node.js/Express + Expo. Twitch4J equivalent = `tmi.js` (chat) + direct Helix fetch.
- **JWT sessions for mobile** — signed with `SESSION_SECRET`, 30-day expiry, sent as `Authorization: Bearer` header.
- **OAuth deep-link flow** — callback serves an HTML page that auto-tries `mobile://auth?token=...` after 1s + shows a copy-able token for manual entry.
- **TwitchBotManager** — singleton that maps `username → tmi.Client`, auto-connects on OAuth callback, non-fatal if chat connection fails.
- **Per-user stream control** — all Helix API calls use the streamer's own access token with auto-refresh on 401.

## Product

- Any streamer logs in via Twitch OAuth2
- Controls their stream title and category from the Controls tab
- Manages moderation (ban/timeout), promotional banners, social links
- Triggers soundboard sounds that appear on an OBS overlay via SSE
- Bot auto-joins their channel on login

## User preferences

- NOT Java — user referred to "Java project" but the stack is Node.js/Express. Always implement Node.js equivalents.

## Gotchas

- Mobile scheme is `"mobile"` (from app.json) — deep links are `mobile://auth?...`
- `TWITCH_REDIRECT_URI` in Replit Secrets must exactly match what's registered in the Twitch Developer Console
- `tmi.js` is CJS — bundled fine by esbuild thanks to the `globalThis.require` banner in build.mjs
- DB schema push: `pnpm --filter @workspace/db run push` (dev only — no migration files generated)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
