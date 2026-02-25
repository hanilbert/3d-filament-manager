export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const res = await fetch(path, {
    ...options,
    credentials: "same-origin", // HttpOnly cookie is sent automatically
    headers: {
      // Don't set Content-Type for FormData — browser sets it with boundary
      ...(!isFormData ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401) {
    // Token expired or invalid — redirect to login
    if (typeof window !== "undefined") {
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
