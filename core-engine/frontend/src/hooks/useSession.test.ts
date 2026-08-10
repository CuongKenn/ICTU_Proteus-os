import { renderHook } from '@testing-library/react';
import { useSession } from './useSession';
import { describe, it, expect, vi } from 'vitest';
import * as nextAuthReact from 'next-auth/react';

vi.mock('next-auth/react');

describe('useSession', () => {
  it('should return unauthenticated state', () => {
    vi.mocked(nextAuthReact.useSession).mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: vi.fn(),
    });

    const { result } = renderHook(() => useSession());
    
    expect(result.current.user).toBeNull();
    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasRole('admin')).toBe(false);
  });

  it('should return loading state', () => {
    vi.mocked(nextAuthReact.useSession).mockReturnValue({
      data: null,
      status: 'loading',
      update: vi.fn(),
    });

    const { result } = renderHook(() => useSession());
    
    expect(result.current.isLoading).toBe(true);
    expect(result.current.status).toBe('loading');
  });

  it('should return authenticated state and check roles', () => {
    vi.mocked(nextAuthReact.useSession).mockReturnValue({
      data: {
        user: { name: 'Admin User', roles: ['tenant_admin', 'editor'] },
        expires: '2026-12-31T00:00:00Z',
      },
      status: 'authenticated',
      update: vi.fn(),
    });

    const { result } = renderHook(() => useSession());
    
    expect(result.current.user?.name).toBe('Admin User');
    expect(result.current.status).toBe('authenticated');
    expect(result.current.hasRole('tenant_admin')).toBe(true);
    expect(result.current.hasRole('editor')).toBe(true);
    expect(result.current.hasRole('guest')).toBe(false);
  });
});
