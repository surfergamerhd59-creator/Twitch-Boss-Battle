import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const DATABASE_URL = process.env["DATABASE_URL"] ?? "";

if (!DATABASE_URL) {
  console.warn(
    "⚠️  DATABASE_URL no está configurado. " +
    "Edita artifacts/api-server/src/config.ts o define la variable de entorno."
  );
}

const isProduction = process.env.NODE_ENV === "production";

export const pool = new Pool({
  connectionString: DATABASE_URL || undefined,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

export const db = drizzle(pool, { schema });

export * from "./schema";
