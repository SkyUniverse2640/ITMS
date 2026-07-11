import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import type { SessionUser, Role, UserType } from "@/types";

const COOKIE_NAME = "nexusdesk-token";

export type AuthenticatedRequest = NextRequest & {
  user: SessionUser;
};

export function withAuth(
  handler: (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<NextResponse>,
  options?: { role?: Role; userTypes?: UserType[] }
) {
  return async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    const token = req.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });
    }

    if (options?.role && user.role !== options.role) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    if (options?.userTypes?.length) {
      const hasType = options.userTypes.some((t) => user.userTypes.includes(t));
      if (!hasType && user.role !== "SuperAdmin") {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
    }

    (req as AuthenticatedRequest).user = user;
    return handler(req, ctx);
  };
}

export function getSearchParams(req: NextRequest) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const search = url.searchParams.get("search") || "";
  const sort = url.searchParams.get("sort") || "-createdAt";
  const status = url.searchParams.get("status") || "";
  const priority = url.searchParams.get("priority") || "";

  return { page: Math.max(1, page), limit: Math.min(100, Math.max(1, limit)), search, sort, status, priority };
}

export function paginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
