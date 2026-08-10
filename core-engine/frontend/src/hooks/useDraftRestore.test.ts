import { renderHook, act } from '@testing-library/react';
import { useDraftRestore } from './useDraftRestore';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('useDraftRestore', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('should save data to sessionStorage', () => {
    const { result } = renderHook(() => useDraftRestore());
    
    act(() => {
      result.current.saveDraft('testKey', { foo: 'bar' });
    });

    expect(sessionStorage.getItem('testKey')).toBe(JSON.stringify({ foo: 'bar' }));
  });

  it('should restore data from sessionStorage', () => {
    sessionStorage.setItem('testKey', JSON.stringify({ hello: 'world' }));
    
    const { result } = renderHook(() => useDraftRestore());
    
    let data;
    act(() => {
      data = result.current.restoreDraft('testKey');
    });

    expect(data).toEqual({ hello: 'world' });
  });

  it('should return null when restoring non-existent key', () => {
    const { result } = renderHook(() => useDraftRestore());
    
    let data;
    act(() => {
      data = result.current.restoreDraft('missingKey');
    });

    expect(data).toBeNull();
  });

  it('should clear data from sessionStorage', () => {
    sessionStorage.setItem('testKey', JSON.stringify({ temp: 123 }));
    
    const { result } = renderHook(() => useDraftRestore());
    
    act(() => {
      result.current.clearDraft('testKey');
    });

    expect(sessionStorage.getItem('testKey')).toBeNull();
  });

  it('should handle invalid JSON during restore gracefully', () => {
    sessionStorage.setItem('badJSON', '{ invalid');
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    const { result } = renderHook(() => useDraftRestore());
    
    let data;
    act(() => {
      data = result.current.restoreDraft('badJSON');
    });

    expect(data).toBeNull();
    expect(consoleWarnSpy).toHaveBeenCalled();
    
    consoleWarnSpy.mockRestore();
  });
});
