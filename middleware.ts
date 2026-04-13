import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function isSafeNextPath(path: string) {
  return path.startsWith("/") && !path.startsWith("//");
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get("access_token")?.value;
  const role = request.cookies.get("user_role")?.value?.toLowerCase();
  const status = request.cookies.get("user_status")?.value?.toLowerCase();
  const hasPin = request.cookies.get("user_has_pin")?.value === "1";

  const isApproved = status === "approved";

  if (pathname.startsWith("/dashboard")) {
    if (!token) {
      const loginUrl = new URL("/auth/login", request.url);
      const next = `${pathname}${search}`;
      if (isSafeNextPath(next)) loginUrl.searchParams.set("next", next);
      return NextResponse.redirect(loginUrl);
    }

    if (!isApproved) {
      return NextResponse.redirect(new URL("/auth/verify-email?mode=pending", request.url));
    }

    if (!hasPin) {
      return NextResponse.redirect(new URL("/auth/verify-email?mode=pending", request.url));
    }

    // UX-only route gating (backend must still enforce permissions).
    if (pathname.startsWith("/dashboard/admin") && role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard/forbidden", request.url));
    }

    if (role === "viewer") {
      if (
        pathname.startsWith("/dashboard/upload") ||
        pathname.startsWith("/dashboard/customers/new") ||
        pathname.startsWith("/dashboard/loans/approved-workbench")
      ) {
        return NextResponse.redirect(new URL("/dashboard/forbidden", request.url));
      }
    }

    if (role === "analyst") {
      if (pathname === "/dashboard" || pathname === "/dashboard/") {
        return NextResponse.redirect(new URL("/dashboard/customers", request.url));
      }
    }
  }

  if (pathname.startsWith("/auth")) {
    if (token) {
      if (!isApproved) {
        if (pathname.startsWith("/auth/verify-email")) {
          return NextResponse.next();
        }
        return NextResponse.redirect(new URL("/auth/verify-email?mode=pending", request.url));
      }
      if (!hasPin) {
        if (pathname.startsWith("/auth/verify-email")) {
          return NextResponse.next();
        }
        return NextResponse.redirect(new URL("/auth/verify-email?mode=pending", request.url));
      }
      const home = role === "analyst" ? "/dashboard/customers" : "/dashboard";
      return NextResponse.redirect(new URL(home, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/:path*"],
};
