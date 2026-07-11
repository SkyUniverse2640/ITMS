export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Asset from "@/lib/models/Asset";
import User from "@/lib/models/User";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const { assets: rows } = await req.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ success: false, error: "No data provided" }, { status: 400 });
  }

  const results: { row: number; status: string; error?: string; assetTag?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.name || !row.assetType || !row.assetTag) {
        results.push({ row: i + 1, status: "failed", error: "Missing required fields (name, assetType, assetTag)" });
        continue;
      }

      let department: string | undefined;
      if (row.assignedToEmail) {
        const user = await User.findOne({ email: row.assignedToEmail.toLowerCase() }).lean();
        if (user) {
          row.assignedTo = (user as Record<string, unknown>)._id;
          department = (user as Record<string, unknown>).department as string;
        }
      } else if (row.assignedToEmployeeId) {
        const user = await User.findOne({ employeeId: row.assignedToEmployeeId }).lean();
        if (user) {
          row.assignedTo = (user as Record<string, unknown>)._id;
          department = (user as Record<string, unknown>).department as string;
        }
      }

      const existing = await Asset.findOne({
        $or: [
          { assetTag: row.assetTag },
          ...(row.serialNumber ? [{ serialNumber: row.serialNumber }] : []),
        ],
      });

      if (existing) {
        Object.assign(existing, { ...row, department: department || existing.department });
        await existing.save();
        results.push({ row: i + 1, status: "updated", assetTag: row.assetTag });
      } else {
        await Asset.create({
          ...row,
          department,
          assetCategory: row.assetCategory || "Hardware",
          currentState: row.currentState || "In Warehouse",
        });
        results.push({ row: i + 1, status: "created", assetTag: row.assetTag });
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
