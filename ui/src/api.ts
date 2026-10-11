// Thin client for Tomo's HTTP API. The session token lives in localStorage; a 401 drops back to the gate.
let token: string = localStorage.token || "";
let onExpired = () => {};

export const session = {
  get token() {
    return token;
  },
  set(t: string) {
    token = localStorage.token = t;
  },
  onExpired(fn: () => void) {
    onExpired = fn;
  },
};

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const r = await fetch(path, {
    method: opts.method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  if (r.status === 401 && !path.startsWith("/api/auth/")) {
    onExpired();
    throw new Error("unauthorized");
  }
  return r.json() as Promise<T>;
}
export const enc = encodeURIComponent;
