export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import type { Prisma, AssetCategory } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { serialize } from "@/lib/serialize";
import { isId } from "@/lib/utils";

const ASSET_CATEGORIES = ["Hardware", "Software", "Consumable"] as const;

const SEARCHABLE = new Set([
  "name",
  "assetTag",
  "assetType",
  "assetCategory",
  "currentState",
  "serialNumber",
  "department",
  "vendor",
]);

function asCategory(v: unknown): AssetCategory | undefined {
  return ASSET_CATEGORIES.includes(v as AssetCategory) ? (v as AssetCategory) : undefined;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "25")));
  const search = url.searchParams.get("search") || "";
  const searchColumn = url.searchParams.get("searchColumn") || "";
  const category = url.searchParams.get("category") || "";
  const state = url.searchParams.get("state") || "";
  const assignedTo = url.searchParams.get("assignedTo") || "";
  const view = url.searchParams.get("view") || "";

  const where: Prisma.AssetWhereInput = {};
  const like = { contains: search, mode: "insensitive" } as const;

  if (view === "my") {
    where.assignedToId = session._id;
  }
  if (search) {
    // assetCategory is an enum — resolve the substring against its value list.
    const q = search.toLowerCase();
    const cats = ASSET_CATEGORIES.filter((c) => c.toLowerCase().includes(q));

    if (SEARCHABLE.has(searchColumn)) {
      if (searchColumn === "assetCategory") where.assetCategory = { in: [...cats] };
      else where[searchColumn as "name"] = like;
    } else {
      where.OR = [
        { name: like },
        { assetTag: like },
        { serialNumber: like },
        { assetType: like },
        { currentState: like },
        { department: like },
        { vendor: like },
        ...(cats.length ? [{ assetCategory: { in: [...cats] } }] : []),
      ];
    }
  }
  if (category) where.assetCategory = asCategory(category) ?? { in: [] };
  if (state) where.currentState = state;
  if (assignedTo) where.assignedToId = isId(assignedTo) ? assignedTo : { in: [] };

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, displayName: true, email: true, department: true } },
        site: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.asset.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: serialize(assets),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  const assetCategory = asCategory(body.assetCategory);
  if (!assetCategory) {
    return NextResponse.json(
      { success: false, error: "assetCategory must be Hardware, Software, or Consumable" },
      { status: 400 }
    );
  }

  const existing = await prisma.asset.findUnique({ where: { assetTag: body.assetTag } });
  if (existing) return NextResponse.json({ success: false, error: "Asset tag already exists" }, { status: 409 });

  const assignedToId = isId(body.assignedTo) ? String(body.assignedTo) : undefined;
  let department: string | undefined =
    typeof body.department === "string" ? body.department : undefined;
  if (assignedToId) {
    const assignedUser = await prisma.user.findUnique({
      where: { id: assignedToId },
      select: { department: true },
    });
    if (assignedUser) department = assignedUser.department ?? undefined;
  }

  const asset = await prisma.asset.create({
    data: {
      name: body.name,
      assetType: body.assetType,
      assetCategory,
      assetTag: body.assetTag,
      serialNumber: body.serialNumber || undefined,
      vendor: body.vendor || undefined,
      purchaseCost: body.purchaseCost != null ? Number(body.purchaseCost) : undefined,
      purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : undefined,
      warrantyExpiredDate: body.warrantyExpiredDate ? new Date(body.warrantyExpiredDate) : undefined,
      currentState: body.currentState || undefined,
      assignedToId,
      department,
      siteId: isId(body.site) ? String(body.site) : undefined,
      licenseKey: body.licenseKey || undefined,
      totalSeats: body.totalSeats != null ? Number(body.totalSeats) : undefined,
      seatsUsed: body.seatsUsed != null ? Number(body.seatsUsed) : undefined,
      stockQuantity: body.stockQuantity != null ? Number(body.stockQuantity) : undefined,
      reorderThreshold: body.reorderThreshold != null ? Number(body.reorderThreshold) : undefined,
      unit: body.unit || undefined,
      comment: body.comment || undefined,
    },
  });

  await createAuditLog({
    actorId: session._id, actorName: session.displayName,
    action: "Create", module: "Asset",
    targetId: asset.id, targetLabel: asset.assetTag,
    after: { name: asset.name, assetTag: asset.assetTag, assetCategory: asset.assetCategory },
  });

  return NextResponse.json({ success: true, data: serialize(asset) }, { status: 201 });
}
