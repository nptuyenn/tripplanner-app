export async function api(path, { token, body, ...options } = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const error = new Error(payload?.message ?? "The request could not be completed");
    error.details = payload?.details ?? [];
    error.status = response.status;
    throw error;
  }

  return payload;
}
