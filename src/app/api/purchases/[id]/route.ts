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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const { id } = await params;
  const purchase = await Purchase.findById(id).populate("requestedBy", "displayName email").populate("approver", "displayName email").populate("linkedAsset", "name assetTag").lean();
  if (!purchase) return NextResponse.json({ success: false, error: "Purchase not found" }, { status: 404 });

  return NextResponse.json({ success: true, data: purchase });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const { id } = await params;
  const body = await req.json();
  const purchase = await Purchase.findById(id);
  if (!purchase) return NextResponse.json({ success: false, error: "Purchase not found" }, { status: 404 });

  const before = { status: purchase.status };

  if (body.approvalAction === "approve") {
    body.status = "Approved";
  } else if (body.approvalAction === "reject") {
    body.status = "Rejected";
    body.rejectionReason = body.rejectionReason || "";
  }
  delete body.approvalAction;

  if (body.status === "Completed" && purchase.status !== "Completed") {
    const asset = await Asset.create({
      name: purchase.itemName,
      assetType: purchase.linkedAssetType || "General",
      assetCategory: "Hardware",
      assetTag: generateAssetTag(),
      vendor: purchase.vendor,
      purchaseCost: purchase.estimatedCost,
      purchaseDate: new Date(),
      currentState: "In Warehouse",
    });
    body.linkedAsset = asset._id;
  }

  Object.assign(purchase, body);
  await purchase.save();

  await Notification.create({
    recipient: purchase.requestedBy,
    title: "Purchase Request Updated",
    message: `Purchase "${purchase.itemName}" status: ${purchase.status}`,
    type: "purchase_update",
    link: `/purchases`,
  });

  await createAuditLog({
    actorId: session._id, actorName: session.displayName,
    action: "Update", module: "Purchase",
    targetId: purchase._id.toString(), targetLabel: purchase.itemName,
    before, after: { status: purchase.status },
  });

  return NextResponse.json({ success: true, data: purchase });
}
