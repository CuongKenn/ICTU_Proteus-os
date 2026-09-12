// Hook dùng chung: resolve store (live/demo) + format lỗi API.
import { useEffect, useState } from 'react';
import { ApiError } from './api';
import {
  getStore,
  type DemoReason,
  type ProcurementStore,
  type StoreMode,
} from './repo';

export interface StoreState {
  mode: StoreMode | null;
  store: ProcurementStore | null;
  reason?: DemoReason;
  message?: string;
}

export function useStore(): StoreState {
  const [s, setS] = useState<StoreState>({ mode: null, store: null });
  useEffect(() => {
    let cancelled = false;
    getStore().then((r) => {
      if (!cancelled) {
        setS({ mode: r.mode, store: r.store, reason: r.reason, message: r.message });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return s;
}

export function errText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return `Không tới được server: ${e.detail}`;
    if (e.status === 502) return `Workflow engine bận/lỗi (502): ${e.detail}`;
    return e.detail;
  }
  return e instanceof Error ? e.message : String(e);
}

export function reasonText(reason?: DemoReason): string | null {
  switch (reason) {
    case 'unauthenticated':
      return 'Chưa đăng nhập — hãy đăng nhập ở Launchpad (proteus.local) rồi tải lại trang.';
    case 'not-installed':
      return 'Plugin chưa ACTIVE trên tenant này — đang hiển thị dữ liệu demo local.';
    case 'offline':
      return 'Không tới được BFF — đang hiển thị dữ liệu demo local.';
    default:
      return null;
  }
}
