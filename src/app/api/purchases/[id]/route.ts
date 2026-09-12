export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { serialize } from "@/lib/serialize";
import { isForeignKeyViolation } from "@/lib/prisma-errors";
import { generateAssetTag, isId } from "@/lib/utils";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isId(id)) {
    return NextResponse.json({ success: false, error: "Purchase not found" }, { status: 404 });
  }
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: {
      requestedBy: { select: { id: true, displayName: true, email: true } },
      approver: { select: { id: true, displayName: true, email: true } },
      linkedAsset: { select: { id: true, name: true, assetTag: true } },
    },
  });
  if (!purchase) return NextResponse.json({ success: false, error: "Purchase not found" }, { status: 404 });

  // Access control: only SuperAdmin, Auditor, the requester, or the approver may view
  const isSuperAdmin = session.role === "SuperAdmin";
  const isAuditor = session.userTypes.includes("Auditor");
  const isRequester = purchase.requestedById === session._id;
  const isApprover = purchase.approverId === session._id;
  if (!isSuperAdmin && !isAuditor && !isRequester && !isApprover) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ success: true, data: serialize(purchase) });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isId(id)) {
    return NextResponse.json({ success: false, error: "Purchase not found" }, { status: 404 });
  }
  const body = await req.json();
  const purchase = await prisma.purchase.findUnique({ where: { id } });
  if (!purchase) return NextResponse.json({ success: false, error: "Purchase not found" }, { status: 404 });

  // Access control: only SuperAdmin, the requester, or the assigned approver
  // may modify a purchase. Approve/reject/complete is restricted further below.
  const isSuperAdmin = session.role === "SuperAdmin";
  const isRequester = purchase.requestedById === session._id;
  const isApprover = purchase.approverId === session._id;
  if (!isSuperAdmin && !isRequester && !isApprover) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const before = { status: purchase.status };

  const data: Prisma.PurchaseUncheckedUpdateInput = {};
  if (typeof body.itemName === "string" && body.itemName.trim()) data.itemName = body.itemName.trim();
  if ("vendor" in body) data.vendor = body.vendor || null;
  if ("justification" in body) data.justification = body.justification || null;
  if ("linkedAssetType" in body) data.linkedAssetType = body.linkedAssetType || null;
  if ("quantity" in body) {
    const n = Number(body.quantity);
    if (!Number.isFinite(n) || n < 1) {
      return NextResponse.json({ success: false, error: "Quantity must be at least 1" }, { status: 400 });
    }
    data.quantity = n;
  }
  if ("estimatedCost" in body) {
    const n = Number(body.estimatedCost);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ success: false, error: "Estimated cost must be 0 or more" }, { status: 400 });
    }
    data.estimatedCost = n;
  }
  if ("approver" in body) {
    data.approverId = isId(body.approver) ? String(body.approver) : null;
  }
  if (typeof body.status === "string" && body.status) data.status = body.status;
  if ("rejectionReason" in body) data.rejectionReason = body.rejectionReason || null;

  // Approve/reject/complete are approval decisions — only the assigned approver
  // or a SuperAdmin may make them. A plain requester cannot self-approve.
  const wantsApprovalDecision =
    body.approvalAction === "approve" ||
    body.approvalAction === "reject" ||
    data.status === "Approved" ||
    data.status === "Rejected" ||
    data.status === "Completed";
  if (wantsApprovalDecision && !isSuperAdmin && !isApprover) {
    return NextResponse.json(
      { success: false, error: "Only the assigned approver can approve, reject, or complete this purchase" },
      { status: 403 }
    );
  }

  if (body.approvalAction === "approve") {
    data.status = "Approved";
  } else if (body.approvalAction === "reject") {
    data.status = "Rejected";
    data.rejectionReason = data.rejectionReason ?? "";
  }

  if (data.status === "Completed" && purchase.status !== "Completed") {
    const asset = await prisma.asset.create({
      data: {
        name: purchase.itemName,
        assetType: purchase.linkedAssetType || "General",
        assetCategory: "Hardware",
        assetTag: generateAssetTag(),
        vendor: purchase.vendor,
        purchaseCost: purchase.estimatedCost,
        purchaseDate: new Date(),
        currentState: "In Warehouse",
      },
    });
    data.linkedAssetId = asset.id;
  }

  let updated;
  try {
    updated = await prisma.purchase.update({ where: { id }, data });
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return NextResponse.json(
        {
          success: false,
          error: "Approver no longer exists. Reload the page and try again.",
        },
        { status: 400 }
      );
    }
    throw err;
  }

  await prisma.notification.create({
    data: {
      recipientId: updated.requestedById,
      title: "Purchase Request Updated",
      message: `Purchase "${updated.itemName}" status: ${updated.status}`,
      type: "purchase_update",
      link: `/purchases`,
    },
  });

  await createAuditLog({
    actorId: session._id, actorName: session.displayName,
    action: "Update", module: "Purchase",
    targetId: updated.id, targetLabel: updated.itemName,
    before, after: { status: updated.status },
  });

  return NextResponse.json({ success: true, data: serialize(updated) });
}
