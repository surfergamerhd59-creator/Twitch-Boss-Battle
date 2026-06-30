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
