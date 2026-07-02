---
name: Stack is Node.js not Java
description: User refers to this as a "Java project" but it is entirely Node.js/Express + Expo
---

## The rule
This project is **Node.js/Express** on the backend and **Expo/React Native** on mobile. There is no Java, Spring Boot, Maven, Gradle, or JVM anywhere.

**Why:** The user originally described their requirements in Java/Spring terms (Twitch4J, pom.xml, H2 database, @Service). These were implemented as Node.js equivalents:
- Twitch4J Chat → `tmi.js`
- Twitch4J Helix → direct `fetch` to Twitch Helix API
- Spring Boot Web → Express 5
- SQLite/H2 → PostgreSQL + Drizzle ORM
- `Map<String, TwitchClient>` → `Map<string, tmi.Client>` singleton in TwitchBotManager

**How to apply:** When the user asks for "Java" features or references Spring/Maven/pom.xml, implement the Node.js/Express equivalent and explain the mapping once if they seem confused.

## Same pattern with ORM confusion
The user also once asked to add Prisma (with `npx prisma db push`) to fix a Render deploy error, but the DB layer is Drizzle ORM (`lib/db/`), not Prisma — no `schema.prisma` exists anywhere.

**Why:** Generic "fix Render deploy" tutorials online often assume Prisma, since it's the most common Node ORM in guides. The user copies that advice without realizing it doesn't match this codebase.

**How to apply:** Before implementing any ORM/deploy-tooling request that doesn't match the actual stack, grep the repo for confirmation (e.g. check for `schema.prisma`, `drizzle.config.ts`) and push back with evidence rather than complying — then ask for the real error text. For auto-creating tables on Render, use `pnpm --filter @workspace/db run push-force` (wraps `drizzle-kit push --force`) in the Render build command, not raw `npx drizzle-kit` (won't resolve the binary from repo root).
