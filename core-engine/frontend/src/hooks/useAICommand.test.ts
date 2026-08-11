// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { renderHook, act } from '@testing-library/react';
import { useAICommand } from './useAICommand';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch
global.fetch = vi.fn();

describe('useAICommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'completed',
        result: 'Mock result',
      }),
    });
  });

  it('initializes with collapsed state and a welcome message', () => {
    const { result } = renderHook(() => useAICommand());
    expect(result.current.widgetState).toBe('collapsed');
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe('assistant');
  });

  it('can open and close the widget', () => {
    const { result } = renderHook(() => useAICommand());
    
    act(() => {
      result.current.openWidget();
    });
    expect(result.current.widgetState).toBe('expanded');

    act(() => {
      result.current.resetAndClose();
    });

    expect(result.current.widgetState).toBe("collapsed");
  });

  it('sends command and updates state accordingly', async () => {
    const { result } = renderHook(() => useAICommand());
    
    act(() => {
      result.current.setInputValue('Hello AI');
    });

    await act(async () => {
      await result.current.sendCommand();
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/ai/command', expect.any(Object));
    expect(result.current.inputValue).toBe('');
    expect(result.current.messages.some(m => m.content === 'Hello AI' && m.role === 'user')).toBe(true);
    // Since mock fetch returns completed status:
    expect(result.current.messages.some(m => m.content === 'Mock result' && m.role === 'assistant')).toBe(true);
  });
});
