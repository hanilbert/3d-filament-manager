const MAX_ERROR_MESSAGE_LENGTH = 120;

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
    let message = `请求失败（HTTP ${res.status}）`;
    const contentType = res.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const err = await res.json().catch(() => null);
      if (err && typeof err.error === "string" && err.error.trim()) {
        message = err.error;
      }
    } else {
      const text = await res.text().catch(() => "");
      if (text.trim()) {
        message = `${message}: ${text.slice(0, MAX_ERROR_MESSAGE_LENGTH)}`;
      }
    }

    throw new Error(message);
  }

  return res.json();
}
