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

function normalizeNationalId(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function isCustomersCreateOrUpdate(path: string[], method: string) {
  const root = path[0] || "";
  if (root !== "customers") return false;
  if (method === "POST" && path.length === 1) return true;
  if (method === "PUT" && path.length >= 2) return true;
  return false;
}

function deriveUsernameFromEmail(email: unknown) {
  const raw = String(email ?? "").trim();
  if (!raw) return "";
  const atIndex = raw.indexOf("@");
  return atIndex > 0 ? raw.slice(0, atIndex).trim() : raw;
}

function normalizeRegistrationUsernameInPayload(payload: unknown): unknown {
  const listTransform = (row: unknown) => {
    const obj = asRecord(row);
    if (!obj) return row;
    const derived = deriveUsernameFromEmail(obj.email);
    if (!derived) return row;
    return { ...obj, username: derived, user_name: derived, userName: derived };
  };

  if (Array.isArray(payload)) return payload.map(listTransform);
  const obj = asRecord(payload);
  if (!obj) return payload;

  if (Array.isArray(obj.items)) return { ...obj, items: obj.items.map(listTransform) };
  if (Array.isArray(obj.results)) return { ...obj, results: obj.results.map(listTransform) };
  if (Array.isArray(obj.data)) return { ...obj, data: obj.data.map(listTransform) };

  const derived = deriveUsernameFromEmail(obj.email);
  if (!derived) return payload;
  return { ...obj, username: derived, user_name: derived, userName: derived };
}

function isRegistrationResponse(path: string[], method: string) {
  if (method !== "GET") return false;
  if (path[0] !== "auth" || path[1] !== "register") return false;
  if (path[2] === "list") return true;
  if (path[2] === "registration" && path.length >= 4) return true;
  return false;
}

async function enforceNationalIdUniqueness(params: {
  request: NextRequest;
  apiBaseUrl: string;
  path: string[];
  method: string;
  headers: Headers;
}) {
  const { request, apiBaseUrl, path, method, headers } = params;
  if (!isCustomersCreateOrUpdate(path, method)) return null;

  let payload: Record<string, unknown> | null = null;
  try {
    const json = await request.clone().json();
    payload = asRecord(json);
  } catch {
    payload = null;
  }
  if (!payload) return null;

  const rawNationalId = String(payload.national_id ?? "").trim();
  if (!rawNationalId) {
    if (method === "POST") {
      return NextResponse.json(
        {
          error: "CCCD is required.",
          field: "national_id",
        },
        { status: 422 },
      );
    }
    return null;
  }

  if (!/^\d{12}$/.test(rawNationalId)) {
    return NextResponse.json(
      {
        error: "CCCD must be exactly 12 digits.",
        field: "national_id",
      },
      { status: 422 },
    );
  }

  const normalizedNationalId = normalizeNationalId(rawNationalId);
  if (!normalizedNationalId) return null;

  const lookupUrl = new URL("customers", apiBaseUrl);
  lookupUrl.searchParams.set("page", "1");
  lookupUrl.searchParams.set("limit", "100");
  lookupUrl.searchParams.set("search_name", normalizedNationalId);

  let lookupResp: Response;
  try {
    lookupResp = await fetch(lookupUrl, {
      method: "GET",
      headers,
      cache: "no-store",
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Unable to validate national_id uniqueness.",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }

  if (!lookupResp.ok) {
    return NextResponse.json(
      {
        error: "Unable to validate national_id uniqueness.",
        details: `Lookup failed with status ${lookupResp.status}.`,
      },
      { status: 503 },
    );
  }

  const lookupData = (await lookupResp.json()) as Record<string, unknown>;
  const existingList = Array.isArray(lookupData.items)
    ? lookupData.items
    : Array.isArray(lookupData.customers)
      ? lookupData.customers
      : Array.isArray(lookupData.results)
        ? lookupData.results
        : Array.isArray(lookupData.data)
          ? lookupData.data
          : [];

  const updatingCustomerId = method === "PUT" ? String(path[1] || "").trim() : "";
  const hasDuplicate = existingList.some((item) => {
    const row = asRecord(item);
    if (!row) return false;
    const existingNationalId = normalizeNationalId(row.national_id);
    if (existingNationalId !== normalizedNationalId) return false;
    if (!updatingCustomerId) return true;
    const existingId = String(row.customer_id ?? row.id ?? "").trim();
    return existingId !== updatingCustomerId;
  });

  if (hasDuplicate) {
    return NextResponse.json(
      {
        error: "National ID already exists.",
        field: "national_id",
      },
      { status: 409 },
    );
  }

  return null;
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
    const preValidationResponse = await enforceNationalIdUniqueness({
      request,
      apiBaseUrl,
      path,
      method,
      headers,
    });
    if (preValidationResponse) return preValidationResponse;

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

    if (
      isRegistrationResponse(path, method) &&
      String(upstreamResponse.headers.get("content-type") || "").toLowerCase().includes("application/json")
    ) {
      const rawJson = await upstreamResponse.json();
      const normalizedJson = normalizeRegistrationUsernameInPayload(rawJson);
      return NextResponse.json(normalizedJson, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    }

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
