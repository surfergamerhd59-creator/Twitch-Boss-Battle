import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    connectionString: "postgresql://admin:VvTOCWxSDdU9Gj3Ye5rwyzB7eeiTHtt0@://render.com",
    ssl: { rejectUnauthorized: false }
  },
