export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { seedDatabase } from "@/lib/seed";
import { getSession } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/lib/models/User";

/**
 * POST /api/seed
 * - Default: seed only if no admin exists
 * - { force: true }: wipe all data + reseed (requires SuperAdmin if any user exists)
 */
export async function POST(req: NextRequest) {
  try {
    let force = false;
    try {
      const body = await req.json();
      force = Boolean(body?.force);
    } catch {
      force = false;
    }

    if (force) {
      await connectDB();
      const userCount = await User.countDocuments();
      if (userCount > 0) {
        const session = await getSession();
        if (!session || session.role !== "SuperAdmin") {
          // Allow force only with SuperAdmin session when data already exists
          // OR with env override for ops (never in production without intent)
          const secret = req.headers.get("x-seed-force-secret");
          const expected = process.env.SEED_FORCE_SECRET;
          if (!expected || secret !== expected) {
            return NextResponse.json(
              {
                success: false,
                error:
                  "Force seed requires SuperAdmin session or x-seed-force-secret header matching SEED_FORCE_SECRET",
              },
              { status: 403 }
            );
          }
        }
      }
    }

    const result = await seedDatabase({ force });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ success: false, error: "Seed failed" }, { status: 500 });
  }
}
