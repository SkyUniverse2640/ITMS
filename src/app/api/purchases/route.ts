export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { serialize } from "@/lib/serialize";
import { isForeignKeyViolation } from "@/lib/prisma-errors";
import { isId } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "20"));
  const status = url.searchParams.get("status") || "";
  const view = url.searchParams.get("view") || "";

  const where: Prisma.PurchaseWhereInput = {};
  if (session.role !== "SuperAdmin" && !session.userTypes.includes("Auditor")) {
    if (view === "approvals") {
      where.approverId = session._id;
    } else {
      where.OR = [{ requestedById: session._id }, { approverId: session._id }];
    }
  }
  if (status) where.status = status;

  const [purchases, total] = await Promise.all([
    prisma.purchase.findMany({
      where,
      include: {
        requestedBy: { select: { id: true, displayName: true } },
        approver: { select: { id: true, displayName: true } },
        linkedAsset: { select: { id: true, name: true, assetTag: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.purchase.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: serialize(purchases),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const itemName = typeof body.itemName === "string" ? body.itemName.trim() : "";
  if (!itemName) {
    return NextResponse.json({ success: false, error: "Item name is required" }, { status: 400 });
  }

  const quantity = Number(body.quantity);
  if (!Number.isFinite(quantity) || quantity < 1) {
    return NextResponse.json({ success: false, error: "Quantity must be at least 1" }, { status: 400 });
  }

  const estimatedCost = Number(body.estimatedCost);
  if (!Number.isFinite(estimatedCost) || estimatedCost < 0) {
    return NextResponse.json({ success: false, error: "Estimated cost must be 0 or more" }, { status: 400 });
  }

  let purchase;
  try {
    purchase = await prisma.purchase.create({
      data: {
        itemName,
        quantity,
        estimatedCost,
        vendor: typeof body.vendor === "string" ? body.vendor : undefined,
        justification: typeof body.justification === "string" ? body.justification : undefined,
        status: typeof body.status === "string" && body.status ? body.status : "Draft",
        approverId: isId(body.approver) ? String(body.approver) : undefined,
        linkedAssetId: isId(body.linkedAsset) ? String(body.linkedAsset) : undefined,
        linkedAssetType:
          typeof body.linkedAssetType === "string" ? body.linkedAssetType : undefined,
        requestedById: session._id,
      },
    });
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return NextResponse.json(
        {
          success: false,
          error: "Approver or linked asset no longer exists. Reload the page and try again.",
        },
        { status: 400 }
      );
    }
    throw err;
  }

  if (purchase.status === "Pending Approval" && purchase.approverId) {
    await prisma.notification.create({
      data: {
        recipientId: purchase.approverId,
        title: "Purchase Approval Needed",
        message: `Purchase request for ${purchase.itemName}`,
        type: "approval_requested",
        link: `/purchases`,
      },
    });
  }

  await createAuditLog({
    actorId: session._id, actorName: session.displayName,
    action: "Create", module: "Purchase",
    targetId: purchase.id, targetLabel: purchase.itemName,
  });

  return NextResponse.json({ success: true, data: serialize(purchase) }, { status: 201 });
}
