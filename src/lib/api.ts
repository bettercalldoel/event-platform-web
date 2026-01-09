// src/lib/api.ts
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:4000";

type ApiOptions = {
  method?: string;
  body?: any;
  token?: string;
  headers?: Record<string, string>;
};

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const method = opts.method ?? "GET";

  const headers: Record<string, string> = {
    ...(opts.headers ?? {}),
  };

  // kalau body bukan FormData, set JSON
  const isFormData = typeof FormData !== "undefined" && opts.body instanceof FormData;

  if (!isFormData) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }

  if (opts.token) {
    headers["Authorization"] = `Bearer ${opts.token}`;
  }

  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

  const res = await fetch(url, {
    method,
    headers,
    body: opts.body
      ? isFormData
        ? opts.body
        : JSON.stringify(opts.body)
      : undefined,
    cache: "no-store",
  });

  // kalau response bukan JSON, lempar text biar kelihatan error HTML
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  const data = isJson ? await res.json().catch(() => null) : await res.text().catch(() => "");

  if (!res.ok) {
    const msg =
      (isJson && (data as any)?.message) ||
      (typeof data === "string" && data) ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data as T;
}

// helper optional (kalau kamu pakai formatIDR)
export function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(n);
}
