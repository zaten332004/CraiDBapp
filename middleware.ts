import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function isSafeNextPath(path: string) {
  return path.startsWith("/") && !path.startsWith("//");
}

function isInactiveFlag(value: string | undefined) {
  if (!value) return false;
  const v = String(value).trim().toLowerCase();
  return v === "0" || v === "false" || v === "inactive" || v === "disabled";
}

function redirectToDisabledLogin(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/auth/login?reason=account_disabled", request.url));
  response.cookies.set("access_token", "", { path: "/", maxAge: 0 });
  response.cookies.set("user_role", "", { path: "/", maxAge: 0 });
  response.cookies.set("user_status", "", { path: "/", maxAge: 0 });
  response.cookies.set("user_has_pin", "", { path: "/", maxAge: 0 });
  response.cookies.set("user_is_active", "", { path: "/", maxAge: 0 });
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get("access_token")?.value;
  const role = request.cookies.get("user_role")?.value?.toLowerCase();
  const status = request.cookies.get("user_status")?.value?.toLowerCase();
  const hasPin = request.cookies.get("user_has_pin")?.value === "1";
  const isInactive = isInactiveFlag(request.cookies.get("user_is_active")?.value);

  const isApproved = status === "approved";

  if (pathname.startsWith("/dashboard")) {
    if (!token) {
      const loginUrl = new URL("/auth/login", request.url);
      const next = `${pathname}${search}`;
      if (isSafeNextPath(next)) loginUrl.searchParams.set("next", next);
      return NextResponse.redirect(loginUrl);
    }
    if (isInactive) {
      return redirectToDisabledLogin(request);
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
      if (isInactive) {
        if (pathname.startsWith("/auth/login")) {
          return NextResponse.next();
        }
        return redirectToDisabledLogin(request);
      }
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
