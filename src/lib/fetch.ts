export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("spool_tracker_token");
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const res = await fetch(path, {
    ...options,
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
      document.cookie = 'spool_tracker_token=; path=/; max-age=0';
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
