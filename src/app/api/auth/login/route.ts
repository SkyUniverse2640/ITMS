export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import connectDB from "@/lib/db";
import User from "@/lib/models/User";
import { signToken, setSessionCookie } from "@/lib/auth";
import type { SessionUser } from "@/types";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, error: "Username and password required" }, { status: 400 });
    }

    const user = await User.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: username.toLowerCase() },
      ],
      status: "Active",
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcryptjs.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    user.lastLogin = new Date();
    await user.save();

    const sessionUser: SessionUser = {
      _id: user._id.toString(),
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      userTypes: Array.from(user.userTypes ?? []),
      department: user.department,
      site: user.site?.toString(),
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
