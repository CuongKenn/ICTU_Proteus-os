// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Theme bootstrap cho MFE gateway. Dùng CHUNG key localStorage với core-engine
// ("proteus-theme") nên khi gateway chạy same-origin ( /plugins-mfe ) nó tự
// đồng bộ theo theme của app chính. Hỗ trợ thêm:
//   - ?theme=dark|light trên URL (khi nhúng iframe)
//   - postMessage { type: "proteus-theme", theme }
//   - storage event (đổi theme ở tab/app chính cùng origin)
//   - prefers-color-scheme lần đầu

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'proteus-theme';

function isTheme(v: unknown): v is Theme {
  return v === 'dark' || v === 'light';
}

function fromQuery(): Theme | null {
  try {
    const v = new URLSearchParams(window.location.search).get('theme');
    return isTheme(v) ? v : null;
  } catch {
    return null;
  }
}

function fromStorage(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isTheme(v) ? v : null;
  } catch {
    return null;
  }
}

export function resolveInitialTheme(): Theme {
  return (
    fromQuery() ??
    fromStorage() ??
    (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  );
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

/** Đổi theme + phát cho app chính (postMessage) để đồng bộ 2 chiều. */
export function setTheme(theme: Theme): void {
  applyTheme(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  try {
    window.parent?.postMessage({ type: 'proteus-theme', theme }, '*');
  } catch {
    /* ignore */
  }
}

export function toggleTheme(current: Theme): Theme {
  const next: Theme = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

/** Khởi tạo theme + lắng nghe thay đổi từ ngoài (storage/message). */
export function initTheme(): Theme {
  const initial = resolveInitialTheme();
  applyTheme(initial);

  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && isTheme(e.newValue)) applyTheme(e.newValue);
  });

  window.addEventListener('message', (e) => {
    const data = e.data as { type?: string; theme?: unknown } | null;
    if (data && data.type === 'proteus-theme' && isTheme(data.theme)) {
      applyTheme(data.theme);
    }
  });

  return initial;
}
