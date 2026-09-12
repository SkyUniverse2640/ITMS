/**
 * Entry point for `prisma db seed` / `npm run db:seed`.
 *
 * The seed data itself lives in src/lib/seed.ts so that this command and
 * POST /api/seed run exactly the same code.
 */
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  // Imported after dotenv runs — src/lib/db.ts reads DATABASE_URL on load.
  const { seedDatabase } = await import("../src/lib/seed");
  const result = await seedDatabase();
  console.log(result.message);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
