export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import prisma from "@/lib/db";
import { signToken, setSessionCookie } from "@/lib/auth";
import type { SessionUser } from "@/types";

// ponytail: in-memory rate limit, use Redis if multi-instance
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, error: "Username and password required" }, { status: 400 });
    }

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateLimitKey = `${clientIp}:${String(username).toLowerCase()}`;
    if (isRateLimited(rateLimitKey)) {
      return NextResponse.json(
        { success: false, error: "Too many login attempts. Please try again later." },
        { status: 429 }
      );
    }

    const handle = String(username).toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        status: "Active",
        OR: [{ username: handle }, { email: handle }],
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcryptjs.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const sessionUser: SessionUser = {
      _id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      // userTypes is extensible at runtime via the `userTypes` setting, so the
      // stored strings are widened to the known union here.
      userTypes: [...user.userTypes] as SessionUser["userTypes"],
      department: user.department ?? undefined,
      site: user.siteId ?? undefined,
      mustChangePassword: user.mustChangePassword,
    };

    const token = await signToken(sessionUser);
    await setSessionCookie(token);

    return NextResponse.json({ success: true, data: sessionUser });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
