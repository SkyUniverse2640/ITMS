export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import bcryptjs from "bcryptjs";

const PIN_KEY = "smtpProtectionPin";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const setting = await prisma.settings.findUnique({ where: { key: PIN_KEY } });
  return NextResponse.json({
    success: true,
    protected: !!setting?.value,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { action, pin, currentPin } = await req.json();

  if (action === "set") {
    if (!pin || pin.length < 4 || pin.length > 8) {
      return NextResponse.json({ success: false, error: "PIN must be 4-8 digits" }, { status: 400 });
    }
    const existing = await prisma.settings.findUnique({ where: { key: PIN_KEY } });
    if (existing?.value) {
      return NextResponse.json({ success: false, error: "Already protected. Remove first." }, { status: 400 });
    }
    const hashed = await bcryptjs.hash(pin, 12);
    await prisma.settings.upsert({
      where: { key: PIN_KEY },
      create: { key: PIN_KEY, value: hashed },
      update: { value: hashed },
    });
    return NextResponse.json({ success: true, message: "PIN set" });
  }

  if (action === "verify") {
    if (!pin) {
      return NextResponse.json({ success: false, error: "PIN required" }, { status: 400 });
    }
    const setting = await prisma.settings.findUnique({ where: { key: PIN_KEY } });
    if (!setting?.value) {
      return NextResponse.json({ success: true, verified: true });
    }
    const match = await bcryptjs.compare(pin, String(setting.value));
    return NextResponse.json({ success: true, verified: match });
  }

  if (action === "remove") {
    if (!currentPin) {
      return NextResponse.json({ success: false, error: "Current PIN required" }, { status: 400 });
    }
    const setting = await prisma.settings.findUnique({ where: { key: PIN_KEY } });
    if (!setting?.value) {
      return NextResponse.json({ success: true, message: "Not protected" });
    }
    const match = await bcryptjs.compare(currentPin, String(setting.value));
    if (!match) {
      return NextResponse.json({ success: false, error: "Incorrect PIN" }, { status: 403 });
    }
    await prisma.settings.delete({ where: { key: PIN_KEY } });
    return NextResponse.json({ success: true, message: "Protection removed" });
  }

  return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
}
