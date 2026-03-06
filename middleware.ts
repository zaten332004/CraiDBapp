import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function isSafeNextPath(path: string) {
  return path.startsWith("/") && !path.startsWith("//");
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get("access_token")?.value;
  const role = request.cookies.get("user_role")?.value?.toLowerCase();

  if (pathname.startsWith("/dashboard")) {
    if (!token) {
      const loginUrl = new URL("/auth/login", request.url);
      const next = `${pathname}${search}`;
      if (isSafeNextPath(next)) loginUrl.searchParams.set("next", next);
      return NextResponse.redirect(loginUrl);
    }

    // UX-only route gating (backend must still enforce permissions).
    if (pathname.startsWith("/dashboard/admin") && role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard/forbidden", request.url));
    }

    if (role === "viewer") {
      if (
        pathname.startsWith("/dashboard/upload") ||
        pathname.startsWith("/dashboard/customers/new") ||
        pathname.startsWith("/dashboard/risk/batch")
      ) {
        return NextResponse.redirect(new URL("/dashboard/forbidden", request.url));
      }
    }
  }

  if (pathname.startsWith("/auth")) {
    if (token) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/:path*"],
};
