export class ApiError extends Error {
  status: number;
  url: string;
  bodyText?: string;

  constructor(message: string, args: { status: number; url: string; bodyText?: string }) {
    super(message);
    this.name = "ApiError";
    this.status = args.status;
    this.url = args.url;
    this.bodyText = args.bodyText;
  }
}

export type ApiFetchOptions = Omit<RequestInit, "body" | "headers"> & {
  headers?: Record<string, string | undefined>;
  body?: unknown;
};

export function joinUrl(baseUrl: string, path: string) {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return new URL(cleanPath, base).toString();
}

export async function fetchJson<T>(url: string, options: ApiFetchOptions = {}): Promise<T> {
  const headers = new Headers();
  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      if (value != null) headers.set(key, value);
    }
  }

  const hasBody = options.body !== undefined;
  if (hasBody && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (!headers.has("accept")) headers.set("accept", "application/json");

  const response = await fetch(url, {
    ...options,
    headers,
    body: hasBody ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let bodyText: string | undefined;
    try {
      bodyText = await response.text();
    } catch {
      bodyText = undefined;
    }
    throw new ApiError(`API request failed (${response.status})`, {
      status: response.status,
      url,
      bodyText,
    });
  }

  return (await response.json()) as T;
}

