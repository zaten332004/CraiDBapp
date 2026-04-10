import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
]);

function getApiBaseUrl() {
  const baseUrl =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://127.0.0.1:8000/api/v1";
  if (!baseUrl) return null;
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function assertSafePathSegments(segments: string[]) {
  for (const segment of segments) {
    if (!segment) continue;
    if (segment === "." || segment === ".." || segment.includes("\\")) {
      throw new Error("Invalid path segment");
    }
  }
}

function getAccessTokenFromCookie(request: NextRequest) {
  const token = request.cookies.get("access_token")?.value;
  if (!token) return null;
  return token;
}

async function proxy(request: NextRequest, context: RouteContext) {
  try {
    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl) {
      return NextResponse.json(
        { error: "Missing API_BASE_URL (or NEXT_PUBLIC_API_BASE_URL) env var." },
        { status: 500 },
      );
    }

    const { path } = await context.params;
    assertSafePathSegments(path);
    const upstreamUrl = new URL(path.join("/"), apiBaseUrl);
    upstreamUrl.search = request.nextUrl.search;

    const headers = new Headers();
    request.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (HOP_BY_HOP_HEADERS.has(lowerKey)) return;
      headers.set(key, value);
    });

    if (!headers.has("authorization")) {
      const accessToken = getAccessTokenFromCookie(request);
      if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
    }

    const method = request.method.toUpperCase();
    const body =
      method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(upstreamUrl, {
        method,
        headers,
        body,
        redirect: "manual",
        cache: "no-store",
      });
    } catch (err) {
      return NextResponse.json(
        {
          error: "Failed to reach upstream API",
          upstreamUrl: upstreamUrl.toString(),
          details: err instanceof Error ? err.message : String(err),
          hint: "Check API_BASE_URL and ensure the backend is running/reachable.",
        },
        { status: 502 },
      );
    }

    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.delete("content-encoding");

    return new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Proxy route crashed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}
