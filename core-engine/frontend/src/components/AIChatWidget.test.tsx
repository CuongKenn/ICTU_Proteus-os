import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AIChatWidget } from './AIChatWidget';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAICommand } from '@/hooks/useAICommand';

// Mock the hook
vi.mock('@/hooks/useAICommand', () => ({
  useAICommand: vi.fn(),
}));

describe('AIChatWidget', () => {
  const mockOpenWidget = vi.fn();
  const mockCloseWidget = vi.fn();
  const mockSendCommand = vi.fn();
  const mockSetInputValue = vi.fn();
  const mockOpenMattermostApproval = vi.fn();
  const mockCancelApproval = vi.fn();

  const defaultMockReturn = {
    widgetState: 'collapsed' as const,
    messages: [],
    inputValue: '',
    dslPreview: null,
    sessionId: 'test-session',
    setInputValue: mockSetInputValue,
    openWidget: mockOpenWidget,
    closeWidget: mockCloseWidget,
    sendCommand: mockSendCommand,
    openMattermostApproval: mockOpenMattermostApproval,
    cancelApproval: mockCancelApproval,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAICommand as ReturnType<typeof vi.fn>).mockReturnValue(defaultMockReturn);
    
    // Mock scrollIntoView
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('renders floating button initially', () => {
    render(<AIChatWidget />);
    const fab = screen.getByRole('button', { name: /Mở Proteus AI/i });
    expect(fab).toBeInTheDocument();
  });

  it('calls openWidget when fab is clicked in collapsed state', () => {
    render(<AIChatWidget />);
    const fab = screen.getByRole('button', { name: /Mở Proteus AI/i });
    fireEvent.click(fab);
    expect(mockOpenWidget).toHaveBeenCalled();
  });

  it('shows input and messages when expanded', () => {
    (useAICommand as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultMockReturn,
      widgetState: 'expanded',
      messages: [{ id: '1', role: 'assistant', content: 'Hello there', timestamp: new Date() }],
    });

    render(<AIChatWidget />);
    expect(screen.getByText('Hello there')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Nhập lệnh bằng tiếng Việt/i)).toBeInTheDocument();
  });

  it('disables input when thinking', () => {
    (useAICommand as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultMockReturn,
      widgetState: 'thinking',
    });

    render(<AIChatWidget />);
    const input = screen.getByPlaceholderText(/Nhập lệnh bằng tiếng Việt/i);
    expect(input).toBeDisabled();
    expect(screen.getByText('Đang phân tích')).toBeInTheDocument();
  });
});
