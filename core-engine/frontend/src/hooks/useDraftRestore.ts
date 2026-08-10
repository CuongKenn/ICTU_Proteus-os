// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// useDraftRestore — Custom Hook xử lý dữ liệu draft qua sessionStorage

import { useCallback } from "react";

interface UseDraftRestoreReturn {
  saveDraft: <T>(key: string, data: T) => void;
  restoreDraft: <T>(key: string) => T | null;
  clearDraft: (key: string) => void;
}

export function useDraftRestore(): UseDraftRestoreReturn {
  const saveDraft = useCallback(<T,>(key: string, data: T) => {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(key, JSON.stringify(data));
      }
    } catch (error) {
      console.warn("[useDraftRestore] Failed to save draft:", error);
    }
  }, []);

  const restoreDraft = useCallback(<T,>(key: string): T | null => {
    try {
      if (typeof window !== "undefined") {
        const item = sessionStorage.getItem(key);
        if (item) {
          return JSON.parse(item) as T;
        }
      }
      return null;
    } catch (error) {
      console.warn("[useDraftRestore] Failed to restore draft:", error);
      return null;
    }
  }, []);

  const clearDraft = useCallback((key: string) => {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(key);
      }
    } catch (error) {
      console.warn("[useDraftRestore] Failed to clear draft:", error);
    }
  }, []);

  return { saveDraft, restoreDraft, clearDraft };
}
