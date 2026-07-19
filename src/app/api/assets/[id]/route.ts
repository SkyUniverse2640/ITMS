export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Asset from "@/lib/models/Asset";
import User from "@/lib/models/User";
import Notification from "@/lib/models/Notification";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const { id } = await params;
  const asset = await Asset.findById(id).populate("assignedTo", "displayName email department").populate("site", "name").lean();
  if (!asset) return NextResponse.json({ success: false, error: "Asset not found" }, { status: 404 });

  return NextResponse.json({ success: true, data: asset });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const { id } = await params;
  const body = await req.json();
  const asset = await Asset.findById(id);
  if (!asset) return NextResponse.json({ success: false, error: "Asset not found" }, { status: 404 });

  const before = { assignedTo: asset.assignedTo?.toString(), currentState: asset.currentState };

  const ALLOWED_ASSET_FIELDS = new Set([
    "name", "assetType", "assetCategory", "assetTag", "serialNumber",
    "vendor", "purchaseCost", "purchaseDate", "warrantyExpiredDate",
    "currentState", "assignedTo", "department", "site", "licenseKey",
    "totalSeats", "seatsUsed", "stockQuantity", "reorderThreshold",
    "unit", "comment",
  ]);
  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (ALLOWED_ASSET_FIELDS.has(key)) sanitized[key] = body[key];
  }

  if (sanitized.assignedTo && sanitized.assignedTo !== asset.assignedTo?.toString()) {
    const assignedUser = await User.findById(sanitized.assignedTo).lean();
    if (assignedUser) sanitized.department = (assignedUser as Record<string, unknown>).department;

    await Notification.create({
      recipient: sanitized.assignedTo,
      title: "Asset Assigned",
      message: `Asset ${asset.assetTag} (${asset.name}) has been assigned to you`,
      type: "asset_assigned",
      link: `/assets/${asset._id}`,
    });
  }

  Object.assign(asset, sanitized);
  await asset.save();

  await createAuditLog({
    actorId: session._id, actorName: session.displayName,
    action: "Update", module: "Asset",
    targetId: asset._id.toString(), targetLabel: asset.assetTag,
    before, after: { assignedTo: asset.assignedTo?.toString(), currentState: asset.currentState },
  });

  return NextResponse.json({ success: true, data: asset });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const { id } = await params;
  const asset = await Asset.findByIdAndDelete(id);
  if (!asset) return NextResponse.json({ success: false, error: "Asset not found" }, { status: 404 });

  await createAuditLog({
    actorId: session._id, actorName: session.displayName,
    action: "Delete", module: "Asset",
    targetId: asset._id.toString(), targetLabel: asset.assetTag,
    before: { name: asset.name, assetTag: asset.assetTag },
  });

  return NextResponse.json({ success: true, message: "Asset deleted" });
}
