import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Supabase Postgres migrations. Requires DATABASE_URL (the Supabase connection
// string). Run: npm run db:pg:generate && npm run db:pg:migrate
export default defineConfig({
  schema: "./src/db/schema.pg.ts",
  out: "./drizzle/pg",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? ""
  }
});
