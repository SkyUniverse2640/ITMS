import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js reads .env.local; the Prisma CLI would otherwise only read .env.
// Load both so `prisma migrate` and the app share one DATABASE_URL.
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Read directly rather than via prisma's env() helper: `prisma generate`
    // does not need a database, and env() throws when the variable is unset,
    // which would break the Docker build.
    url: process.env.DATABASE_URL,
  },
});
