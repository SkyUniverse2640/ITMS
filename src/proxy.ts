import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "nexusdesk-secret-change-in-production"
);

const publicPaths = ["/login", "/api/auth/login", "/api/seed"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Static / brand media must never require auth (login page logos, favicons)
  if (
    publicPaths.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/logo.avif" ||
    pathname.startsWith("/Images/") ||
    pathname.startsWith("/Fonts/") ||
    pathname.startsWith("/Templates/") ||
    pathname.startsWith("/Sound/") ||
    pathname.startsWith("/sound/") ||
    pathname.startsWith("/uploads/") ||
    pathname.startsWith("/api/brand") ||
    /\.(png|jpe?g|avif|webp|gif|svg|ico|woff2?|ttf|otf|mp3|csv)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get("nexusdesk-token")?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // Force password change before any app access (except auth endpoints + change-password page)
    if (
      payload.mustChangePassword &&
      pathname !== "/change-password" &&
      !pathname.startsWith("/api/auth")
    ) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ success: false, error: "Must change password" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/change-password", req.url));
    }

    // SuperAdmin panel is SuperAdmin-only, except Audit Trail for Auditor user type
    if (pathname.startsWith("/admin") && payload.role !== "SuperAdmin") {
      const userTypes = (payload.userTypes as string[]) || [];
      const isAuditorAudit =
        userTypes.includes("Auditor") &&
        (pathname === "/admin/audit-trail" || pathname.startsWith("/admin/audit-trail/"));
      if (!isAuditorAudit) {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }

    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL("/login", req.url));
    response.cookies.delete("nexusdesk-token");
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
