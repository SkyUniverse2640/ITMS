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

  // Access control: only SuperAdmin, the requester, or the assigned approver
  // may modify a purchase. Approve/reject/complete is restricted further below.
  const isSuperAdmin = session.role === "SuperAdmin";
  const isRequester = purchase.requestedBy?.toString() === session._id;
  const isApprover = purchase.approver?.toString() === session._id;
  if (!isSuperAdmin && !isRequester && !isApprover) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const before = { status: purchase.status };

  const ALLOWED_PURCHASE_FIELDS = new Set([
    "itemName", "description", "quantity", "unitCost", "totalCost",
    "estimatedCost", "vendor", "category", "priority", "status",
    "approver", "approvalAction", "rejectionReason", "notes",
    "linkedAssetType",
  ]);
  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (ALLOWED_PURCHASE_FIELDS.has(key)) sanitized[key] = body[key];
  }

  // Approve/reject/complete are approval decisions — only the assigned approver
  // or a SuperAdmin may make them. A plain requester cannot self-approve.
  const wantsApprovalDecision =
    sanitized.approvalAction === "approve" ||
    sanitized.approvalAction === "reject" ||
    sanitized.status === "Approved" ||
    sanitized.status === "Rejected" ||
    sanitized.status === "Completed";
  if (wantsApprovalDecision && !isSuperAdmin && !isApprover) {
    return NextResponse.json(
      { success: false, error: "Only the assigned approver can approve, reject, or complete this purchase" },
      { status: 403 }
    );
  }

  if (sanitized.approvalAction === "approve") {
    sanitized.status = "Approved";
  } else if (sanitized.approvalAction === "reject") {
    sanitized.status = "Rejected";
    sanitized.rejectionReason = sanitized.rejectionReason || "";
  }
  delete sanitized.approvalAction;

  if (sanitized.status === "Completed" && purchase.status !== "Completed") {
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
    sanitized.linkedAsset = asset._id;
  }

  Object.assign(purchase, sanitized);
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
