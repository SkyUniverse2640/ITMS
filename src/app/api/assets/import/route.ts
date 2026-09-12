export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import type { Prisma, AssetCategory } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { isId } from "@/lib/utils";

const ASSET_CATEGORIES = ["Hardware", "Software", "Consumable"] as const;

const STRING_FIELDS = [
  "name",
  "assetType",
  "assetTag",
  "serialNumber",
  "vendor",
  "currentState",
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

/** Pull the schema-known fields out of a spreadsheet row. */
function pickAssetFields(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of STRING_FIELDS) {
    if (row[key] != null && String(row[key]).trim() !== "") out[key] = String(row[key]).trim();
  }
  for (const key of NUMBER_FIELDS) {
    if (row[key] != null && String(row[key]).trim() !== "") {
      const n = Number(row[key]);
      if (!Number.isNaN(n)) out[key] = n;
    }
  }
  for (const key of DATE_FIELDS) {
    if (row[key]) {
      const d = new Date(String(row[key]));
      if (!Number.isNaN(d.getTime())) out[key] = d;
    }
  }
  if (ASSET_CATEGORIES.includes(row.assetCategory as AssetCategory)) {
    out.assetCategory = row.assetCategory as AssetCategory;
  }
  if (isId(row.site)) out.siteId = String(row.site);
  return out;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { assets: rows } = await req.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ success: false, error: "No data provided" }, { status: 400 });
  }

  const results: { row: number; status: string; error?: string; assetTag?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Record<string, unknown>;
    try {
      if (!row.name || !row.assetType || !row.assetTag) {
        results.push({ row: i + 1, status: "failed", error: "Missing required fields (name, assetType, assetTag)" });
        continue;
      }

      let assignedToId: string | undefined;
      let department: string | undefined;
      if (row.assignedToEmail) {
        const user = await prisma.user.findUnique({
          where: { email: String(row.assignedToEmail).toLowerCase() },
          select: { id: true, department: true },
        });
        if (user) {
          assignedToId = user.id;
          department = user.department ?? undefined;
        }
      } else if (row.assignedToEmployeeId) {
        const user = await prisma.user.findUnique({
          where: { employeeId: String(row.assignedToEmployeeId) },
          select: { id: true, department: true },
        });
        if (user) {
          assignedToId = user.id;
          department = user.department ?? undefined;
        }
      }

      const fields = pickAssetFields(row);
      const assetTag = String(row.assetTag);
      const serialNumber =
        row.serialNumber && String(row.serialNumber).trim()
          ? String(row.serialNumber).trim()
          : null;

      const existing = await prisma.asset.findFirst({
        where: {
          OR: [
            { assetTag },
            ...(serialNumber ? [{ serialNumber }] : []),
          ],
        },
      });

      if (existing) {
        await prisma.asset.update({
          where: { id: existing.id },
          data: {
            ...(fields as Prisma.AssetUncheckedUpdateInput),
            assignedToId: assignedToId ?? existing.assignedToId,
            department: department ?? existing.department,
          },
        });
        results.push({ row: i + 1, status: "updated", assetTag });
      } else {
        await prisma.asset.create({
          data: {
            ...(fields as Prisma.AssetUncheckedCreateInput),
            name: String(row.name),
            assetType: String(row.assetType),
            assetTag,
            assignedToId,
            department:
              department ??
              (row.department ? String(row.department) : undefined),
            assetCategory: (fields.assetCategory as AssetCategory) || "Hardware",
            currentState: (fields.currentState as string) || "In Warehouse",
          },
        });
        results.push({ row: i + 1, status: "created", assetTag });
      }
    } catch (err) {
      results.push({ row: i + 1, status: "failed", error: (err as Error).message });
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  const updated = results.filter((r) => r.status === "updated").length;
  const failed = results.filter((r) => r.status === "failed").length;

  await createAuditLog({
    actorId: session._id, actorName: session.displayName,
    action: "Create", module: "Asset",
    targetId: "import", targetLabel: `Asset Import: ${created} created, ${updated} updated, ${failed} failed`,
  });

  return NextResponse.json({ success: true, data: { results, summary: { created, updated, failed, total: rows.length } } });
}
