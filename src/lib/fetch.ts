export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("spool_tracker_token");
}

function getCookieToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)spool_tracker_token=([^;]*)/);
  return match?.[1] ?? null;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  // Prefer cookie (HttpOnly set by server), fall back to localStorage for compat
  const token = getCookieToken() || getToken();
  const isFormData = options.body instanceof FormData;
  const res = await fetch(path, {
    ...options,
    credentials: "same-origin", // ensure cookies are sent
    headers: {
      // Don't set Content-Type for FormData — browser sets it with boundary
      ...(!isFormData ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401) {
    // Token 过期或无效，清除并跳转登录
    if (typeof window !== "undefined") {
      localStorage.removeItem("spool_tracker_token");
      localStorage.removeItem("spool_tracker_expires");
      document.cookie = "spool_tracker_token=; path=/; max-age=0";
      window.location.href = "/login";
    }
    throw new Error("登录已过期，请重新登录");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "请求失败" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}
