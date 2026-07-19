export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Asset from "@/lib/models/Asset";
import User from "@/lib/models/User";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { escapeRegex } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "25")));
  const search = url.searchParams.get("search") || "";
  const searchColumn = url.searchParams.get("searchColumn") || "";
  const category = url.searchParams.get("category") || "";
  const state = url.searchParams.get("state") || "";
  const assignedTo = url.searchParams.get("assignedTo") || "";
  const view = url.searchParams.get("view") || "";

  const filter: Record<string, unknown> = {};
  const rx = (q: string) => ({ $regex: escapeRegex(q), $options: "i" });

  const SEARCHABLE: Record<string, string> = {
    name: "name",
    assetTag: "assetTag",
    assetType: "assetType",
    assetCategory: "assetCategory",
    currentState: "currentState",
    serialNumber: "serialNumber",
    department: "department",
    vendor: "vendor",
  };

  if (view === "my") {
    filter.assignedTo = session._id;
  }
  if (search) {
    const col = SEARCHABLE[searchColumn];
    if (col) {
      filter[col] = rx(search);
    } else {
      filter.$or = [
        { name: rx(search) },
        { assetTag: rx(search) },
        { serialNumber: rx(search) },
        { assetType: rx(search) },
        { assetCategory: rx(search) },
        { currentState: rx(search) },
        { department: rx(search) },
        { vendor: rx(search) },
      ];
    }
  }
  if (category) filter.assetCategory = category;
  if (state) filter.currentState = state;
  if (assignedTo) filter.assignedTo = assignedTo;

  const [assets, total] = await Promise.all([
    Asset.find(filter).populate("assignedTo", "displayName email department").populate("site", "name").sort("-createdAt").skip((page - 1) * limit).limit(limit).lean(),
    Asset.countDocuments(filter),
  ]);

  return NextResponse.json({
    success: true,
    data: assets,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const body = await req.json();

  const existing = await Asset.findOne({ assetTag: body.assetTag });
  if (existing) return NextResponse.json({ success: false, error: "Asset tag already exists" }, { status: 409 });

  if (body.assignedTo) {
    const assignedUser = await User.findById(body.assignedTo).lean();
    if (assignedUser) body.department = (assignedUser as Record<string, unknown>).department;
  }

  const asset = await Asset.create({
    name: body.name,
    assetType: body.assetType,
    assetCategory: body.assetCategory,
    assetTag: body.assetTag,
    serialNumber: body.serialNumber,
    vendor: body.vendor,
    purchaseCost: body.purchaseCost,
    purchaseDate: body.purchaseDate,
    warrantyExpiredDate: body.warrantyExpiredDate,
    currentState: body.currentState,
    assignedTo: body.assignedTo,
    department: body.department,
    site: body.site,
    licenseKey: body.licenseKey,
    totalSeats: body.totalSeats,
    seatsUsed: body.seatsUsed,
    stockQuantity: body.stockQuantity,
    reorderThreshold: body.reorderThreshold,
    unit: body.unit,
    comment: body.comment,
  });

  await createAuditLog({
    actorId: session._id, actorName: session.displayName,
    action: "Create", module: "Asset",
    targetId: asset._id.toString(), targetLabel: asset.assetTag,
    after: { name: asset.name, assetTag: asset.assetTag, assetCategory: asset.assetCategory },
  });

  return NextResponse.json({ success: true, data: asset }, { status: 201 });
}
