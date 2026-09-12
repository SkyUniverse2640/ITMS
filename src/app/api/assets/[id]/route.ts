export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import type { Prisma, AssetCategory } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { sendEmail } from "@/lib/send-email";
import { serialize } from "@/lib/serialize";
import { escapeHtml, isId } from "@/lib/utils";

const ASSET_CATEGORIES = ["Hardware", "Software", "Consumable"] as const;

/** Scalar fields a client may set, with the coercion each one needs. */
const STRING_FIELDS = [
  "name",
  "assetType",
  "assetTag",
  "serialNumber",
  "vendor",
  "currentState",
  "department",
  "licenseKey",
  "unit",
  "comment",
] as const;
const NUMBER_FIELDS = [
  "purchaseCost",
  "totalSeats",
  "seatsUsed",
  "stockQuantity",
  "reorderThreshold",
] as const;
const DATE_FIELDS = ["purchaseDate", "warrantyExpiredDate"] as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isId(id)) {
    return NextResponse.json({ success: false, error: "Asset not found" }, { status: 404 });
  }
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, displayName: true, email: true, department: true } },
      site: { select: { id: true, name: true } },
    },
  });
  if (!asset) return NextResponse.json({ success: false, error: "Asset not found" }, { status: 404 });

  return NextResponse.json({ success: true, data: serialize(asset) });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!isId(id)) {
    return NextResponse.json({ success: false, error: "Asset not found" }, { status: 404 });
  }
  const body = await req.json();
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) return NextResponse.json({ success: false, error: "Asset not found" }, { status: 404 });

  const before = { assignedTo: asset.assignedToId ?? undefined, currentState: asset.currentState };

  const data: Prisma.AssetUncheckedUpdateInput = {};
  for (const key of STRING_FIELDS) {
    if (key in body) (data as Record<string, unknown>)[key] = body[key] || null;
  }
  for (const key of NUMBER_FIELDS) {
    if (key in body) {
      (data as Record<string, unknown>)[key] =
        body[key] == null || body[key] === "" ? null : Number(body[key]);
    }
  }
  for (const key of DATE_FIELDS) {
    if (key in body) {
      (data as Record<string, unknown>)[key] = body[key] ? new Date(body[key]) : null;
    }
  }
  if ("assetCategory" in body && ASSET_CATEGORIES.includes(body.assetCategory)) {
    data.assetCategory = body.assetCategory as AssetCategory;
  }
  if ("site" in body) {
    data.siteId = isId(body.site) ? String(body.site) : null;
  }

  // `name` and `assetType` are required columns — reject a blank instead of
  // sending null, which the database would refuse anyway.
  if (data.name === null || data.assetType === null || data.assetTag === null) {
    return NextResponse.json(
      { success: false, error: "name, assetType, and assetTag cannot be empty" },
      { status: 400 }
    );
  }

  const nextAssignee =
    "assignedTo" in body ? (isId(body.assignedTo) ? String(body.assignedTo) : null) : undefined;

  if (nextAssignee !== undefined) {
    data.assignedToId = nextAssignee;
  }

  if (nextAssignee && nextAssignee !== asset.assignedToId) {
    const assignedUser = await prisma.user.findUnique({
      where: { id: nextAssignee },
      select: { email: true, displayName: true, department: true },
    });
    if (assignedUser) data.department = assignedUser.department;

    await prisma.notification.create({
      data: {
        recipientId: nextAssignee,
        title: "Asset Assigned",
        message: `This Assets: ${asset.assetTag} - ${asset.name} has assigned to you.`,
        type: "asset_assigned",
        link: `/assets/${asset.id}`,
      },
    });

    // Email notification for asset assignment
    if (assignedUser?.email) {
      sendEmail({
        to: assignedUser.email,
        subject: `Asset ${escapeHtml(asset.assetTag)} Assigned to You`,
        html: `
          <h2>Asset Assigned</h2>
          <p>Hi ${escapeHtml(assignedUser.displayName || "User")},</p>
          <p>This Assets: <strong>${escapeHtml(asset.assetTag)}</strong> - <strong>${escapeHtml(asset.name)}</strong> has assigned to you.</p>
          <hr/>
          <ul>
            <li><strong>Asset Tag:</strong> ${escapeHtml(asset.assetTag)}</li>
            <li><strong>Name:</strong> ${escapeHtml(asset.name)}</li>
            <li><strong>Category:</strong> ${escapeHtml(asset.assetCategory)}</li>
            <li><strong>Assigned at:</strong> ${new Date().toLocaleString()}</li>
          </ul>
          <p><a href="${escapeHtml(process.env.NEXT_PUBLIC_APP_URL || "")}/assets/${asset.id}">View Asset Details</a></p>
        `,
      }).catch(() => {});
    }
  }

  const updated = await prisma.asset.update({ where: { id }, data });

  await createAuditLog({
    actorId: session._id, actorName: session.displayName,
    action: "Update", module: "Asset",
    targetId: updated.id, targetLabel: updated.assetTag,
    before, after: { assignedTo: updated.assignedToId ?? undefined, currentState: updated.currentState },
  });

  return NextResponse.json({ success: true, data: serialize(updated) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!isId(id)) {
    return NextResponse.json({ success: false, error: "Asset not found" }, { status: 404 });
  }
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) return NextResponse.json({ success: false, error: "Asset not found" }, { status: 404 });

  await prisma.asset.delete({ where: { id } });

  await createAuditLog({
    actorId: session._id, actorName: session.displayName,
    action: "Delete", module: "Asset",
    targetId: asset.id, targetLabel: asset.assetTag,
    before: { name: asset.name, assetTag: asset.assetTag },
  });

  return NextResponse.json({ success: true, message: "Asset deleted" });
}
