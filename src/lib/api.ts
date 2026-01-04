const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type ApiOpts = {
  method?: string;
  token?: string | null;
  body?: any;
  headers?: Record<string, string>;
};

export async function api<T = any>(path: string, opts: ApiOpts = {}): Promise<T> {
  const method = opts.method || "GET";

  const headers: Record<string, string> = {
    ...(opts.headers || {}),
  };

  // Authorization (prevent double "Bearer ")
  if (opts.token) {
    const raw = opts.token.startsWith("Bearer ") ? opts.token.slice(7) : opts.token;
    headers["Authorization"] = `Bearer ${raw}`;
  }

  let body: any = undefined;

  // if body is FormData, don't set JSON content-type
  if (opts.body instanceof FormData) {
    body = opts.body;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body,
    cache: "no-store",
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { message: text };
  }

  if (!res.ok) {
    throw new Error(json?.message || `Request failed (${res.status})`);
  }

  return json as T;
}

export function formatIDR(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}
