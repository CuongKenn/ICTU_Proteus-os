// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
// BFF API client cho Micro-UI.
// Gọi Next.js BFF proxy (cùng site: proteus.local/api/proxy) kèm session
// cookie (credentials:"include"). Browser JS KHÔNG bao giờ thấy JWT.
// Base suy ra từ host hiện tại: plugins.proteus.local → proteus.local,
// localhost dev → localhost:3000.
export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail || `API lỗi ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

export function bffBase(): string {
  const { protocol, hostname } = window.location;
  // Ưu tiên SAME-ORIGIN: MFE host dưới nttspace.online/plugins-mfe/ (subpath)
  // → gọi /api/proxy cùng origin, iframe gửi được session cookie (SameSite=Lax).
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000/api/proxy';
  }
  // Subdomain cũ plugins.* vẫn map về domain gốc (third-party cookie có thể bị
  // chặn — nên dùng subpath same-origin là chính).
  if (hostname.startsWith('plugins.')) {
    return `${protocol}//${hostname.slice('plugins.'.length)}/api/proxy`;
  }
  return `${protocol}//${hostname}/api/proxy`;
}

// Báo MFE shell (cùng window) biết request đang chạy → hiện progress bar.
function trackBusy(delta: number) {
  try {
    const w = window as unknown as { __mfeBusy?: number };
    const next = Math.max(0, (w.__mfeBusy ?? 0) + delta);
    w.__mfeBusy = next;
    window.dispatchEvent(new CustomEvent('mfe-busy', { detail: next }));
  } catch {
    /* không có window — bỏ qua */
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  timeoutMs = 30000,
): Promise<T> {
  trackBusy(1);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${bffBase()}${path}`, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (res.status === 204) return undefined as unknown as T;
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const detail =
        (data && (data.detail || data.error)) || `HTTP ${res.status}`;
      throw new ApiError(res.status, String(detail));
    }
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, e instanceof Error ? e.message : 'Lỗi mạng');
  } finally {
    clearTimeout(timer);
    trackBusy(-1);
  }
}

export interface BffClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown, opts?: { timeoutMs?: number }): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  del(path: string): Promise<void>;
}

export function createBffClient(): BffClient {
  return {
    get: (p) => request('GET', p),
    post: (p, b, opts) => request('POST', p, b, opts?.timeoutMs),
    patch: (p, b) => request('PATCH', p, b ?? {}),
    del: (p) => request('DELETE', p),
  };
}
