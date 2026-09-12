export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { testSmtpConnection } from "@/lib/send-email";

export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const result = await testSmtpConnection();
  return NextResponse.json(result);
}
