export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { serialize } from "@/lib/serialize";
import { isId } from "@/lib/utils";

type DeptRoles = { Director: string[]; Manager: string[]; Supervisor: string[] };
type DeptItem = { id: string; name: string; description?: string; roles?: DeptRoles };

function emptyRoles(): DeptRoles {
  return { Director: [], Manager: [], Supervisor: [] };
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function asList(raw: unknown): DeptItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x, i) => {
      if (typeof x === "string") {
        return { id: `dept-${i}`, name: x.trim(), description: "", roles: emptyRoles() };
      }
      if (x && typeof x === "object") {
        const o = x as Record<string, unknown>;
        const name = String(o.name || "").trim();
        if (!name) return null;
        const r = (o.roles || {}) as Record<string, unknown>;
        const pick = (k: string) =>
          Array.isArray(r[k]) ? (r[k] as unknown[]).map(String).filter(Boolean) : [];
        return {
          id: String(o.id || `dept-${i}`),
          name,
          description: o.description ? String(o.description) : "",
          roles: {
            Director: pick("Director"),
            Manager: pick("Manager"),
            Supervisor: pick("Supervisor"),
          },
        };
      }
      return null;
    })
    .filter(Boolean) as DeptItem[];
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const rows = body.departments ?? body.rows;
  const fileName = typeof body.fileName === "string" ? body.fileName : "import.csv";
  const updateExisting = body.updateExisting !== false;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ success: false, error: "No data provided" }, { status: 400 });
  }

  const setting = await prisma.settings.findUnique({ where: { key: "departments" } });
  let list = asList(setting?.value);

  type RowResult = {
    row: number;
    status: "created" | "updated" | "failed";
    error?: string;
    key?: string;
    data?: Record<string, unknown>;
  };

  const results: RowResult[] = [];
  const seenInFile = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // header = 1
    const raw = rows[i] as Record<string, unknown>;
    const name = String(raw.name ?? raw.department ?? "").trim();
    const description = String(raw.description ?? "").trim();
    const snapshot = { name, description };

    try {
      const errors: string[] = [];
      if (!name) errors.push("name is required");
      if (name.length > 100) errors.push("name must be at most 100 characters");
      if (description.length > 500) errors.push("description must be at most 500 characters");

      const key = name.toLowerCase();
      if (name && seenInFile.has(key)) {
        errors.push(`duplicate department name in file: ${name}`);
      }

      if (errors.length) {
        results.push({ row: rowNum, status: "failed", error: errors.join("; "), data: snapshot });
        continue;
      }

      seenInFile.add(key);
      const existingIdx = list.findIndex((d) => d.name.toLowerCase() === key);

      if (existingIdx >= 0) {
        if (!updateExisting) {
          results.push({
            row: rowNum,
            status: "failed",
            error: `department already exists: ${name}`,
            data: snapshot,
            key: name,
          });
          continue;
        }
        list[existingIdx] = {
          ...list[existingIdx],
          name,
          description: description || list[existingIdx].description || "",
          // preserve hierarchy roles on import update
          roles: list[existingIdx].roles || emptyRoles(),
        };
        results.push({ row: rowNum, status: "updated", key: name, data: snapshot });
      } else {
        list = [
          ...list,
          {
            id: genId(),
            name,
            description,
            roles: emptyRoles(),
          },
        ];
        results.push({ row: rowNum, status: "created", key: name, data: snapshot });
      }
    } catch (err) {
      results.push({
        row: rowNum,
        status: "failed",
        error: (err as Error).message || "Unknown error",
        data: snapshot,
      });
    }
  }

  // Persist only if any success
  const created = results.filter((r) => r.status === "created").length;
  const updated = results.filter((r) => r.status === "updated").length;
  const failed = results.filter((r) => r.status === "failed").length;

  if (created + updated > 0) {
    await prisma.settings.upsert({
      where: { key: "departments" },
      create: { key: "departments", value: list as unknown as Prisma.InputJsonValue },
      update: { value: list as unknown as Prisma.InputJsonValue },
    });
  }

  const failures = results
    .filter((r) => r.status === "failed")
    .map((r) => ({ row: r.row, data: r.data, error: r.error || "failed" }));

  const history = await prisma.importHistory.create({
    data: {
      type: "departments",
      fileName,
      importedById: session._id,
      importedByName: session.displayName,
      summary: { total: rows.length, created, updated, failed },
      failures: failures as unknown as Prisma.InputJsonValue,
      results: results.map((r) => ({
        row: r.row,
        status: r.status,
        error: r.error ?? null,
        key: r.key ?? null,
      })),
    },
  });

  await createAuditLog({
    actorId: session._id,
    actorName: session.displayName,
    action: "Create",
    module: "Settings",
    targetId: history.id,
    targetLabel: `Department Import: ${created} created, ${updated} updated, ${failed} failed (${fileName})`,
  });

  return NextResponse.json({
    success: true,
    data: {
      historyId: history.id,
      results,
      failures,
      summary: { total: rows.length, created, updated, failed },
      departments: list,
    },
  });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));

  if (id) {
    const doc = isId(id)
      ? await prisma.importHistory.findUnique({ where: { id } })
      : null;
    if (!doc || doc.type !== "departments") {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: serialize(doc) });
  }

  const [items, total] = await Promise.all([
    prisma.importHistory.findMany({
      where: { type: "departments" },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.importHistory.count({ where: { type: "departments" } }),
  ]);

  return NextResponse.json({
    success: true,
    data: serialize(items),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
