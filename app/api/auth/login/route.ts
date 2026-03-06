import { NextRequest, NextResponse } from "next/server";

import { serverApiFetch } from "@/lib/api/server";

export const dynamic = "force-dynamic";

type LoginResponse = {
  access_token?: string;
  token?: string;
  [key: string]: unknown;
};

function extractAccessToken(payload: LoginResponse): string | null {
  if (typeof payload.access_token === "string" && payload.access_token.length > 0) {
    return payload.access_token;
  }
  if (typeof payload.token === "string" && payload.token.length > 0) {
    return payload.token;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as unknown;

  const payload = await serverApiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body,
  });

  const accessToken = extractAccessToken(payload);
  if (!accessToken) {
    return NextResponse.json(
      { error: "Login response missing access_token." },
      { status: 502 },
    );
  }

  const response = NextResponse.json(payload);
  response.cookies.set("access_token", accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
  });
  return response;
}

