export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import connectDB from "@/lib/db";
import User from "@/lib/models/User";
import { getSession, clearSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const { currentPassword, newPassword } = await req.json();

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
      return NextResponse.json(
        { success: false, error: "Password must contain letters and numbers" },
        { status: 400 }
      );
    }

    const user = await User.findById(session._id);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Always verify current/temporary password (including first-login force change)
    if (!currentPassword || typeof currentPassword !== "string") {
      return NextResponse.json(
        { success: false, error: "Current password is required" },
        { status: 400 }
      );
    }

    const currentValid = await bcryptjs.compare(currentPassword, user.password);
    if (!currentValid) {
      return NextResponse.json(
        { success: false, error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    // New password must not match the old one
    const sameAsOld = await bcryptjs.compare(newPassword, user.password);
    if (sameAsOld) {
      return NextResponse.json(
        { success: false, error: "New password must be different from your current password" },
        { status: 400 }
      );
    }

    if (newPassword === currentPassword) {
      return NextResponse.json(
        { success: false, error: "New password must be different from your current password" },
        { status: 400 }
      );
    }

    user.password = await bcryptjs.hash(newPassword, 12);
    user.mustChangePassword = false;
    await user.save();

    // Invalidate session — user must sign in again with the new password
    await clearSession();

    return NextResponse.json({
      success: true,
      message: "Password changed. Please sign in with your new password.",
      requireReLogin: true,
    });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
