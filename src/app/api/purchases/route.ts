export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Purchase from "@/lib/models/Purchase";
import Asset from "@/lib/models/Asset";
import Notification from "@/lib/models/Notification";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { generateAssetTag } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "20"));
  const status = url.searchParams.get("status") || "";
  const view = url.searchParams.get("view") || "";

  const filter: Record<string, unknown> = {};
  if (session.role !== "SuperAdmin" && !session.userTypes.includes("Auditor")) {
    if (view === "approvals") {
      filter.approver = session._id;
    } else {
      filter.$or = [{ requestedBy: session._id }, { approver: session._id }];
    }
  }
  if (status) filter.status = status;

  const [purchases, total] = await Promise.all([
    Purchase.find(filter).populate("requestedBy", "displayName").populate("approver", "displayName").populate("linkedAsset", "name assetTag").sort("-createdAt").skip((page - 1) * limit).limit(limit).lean(),
    Purchase.countDocuments(filter),
  ]);

  return NextResponse.json({ success: true, data: purchases, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const body = await req.json();
  const purchase = await Purchase.create({ ...body, requestedBy: session._id });

  if (body.status === "Pending Approval" && purchase.approver) {
    await Notification.create({
      recipient: purchase.approver,
      title: "Purchase Approval Needed",
      message: `Purchase request for ${purchase.itemName}`,
      type: "approval_requested",
      link: `/purchases`,
    });
  }

  await createAuditLog({
    actorId: session._id, actorName: session.displayName,
    action: "Create", module: "Purchase",
    targetId: purchase._id.toString(), targetLabel: purchase.itemName,
  });

  return NextResponse.json({ success: true, data: purchase }, { status: 201 });
}
