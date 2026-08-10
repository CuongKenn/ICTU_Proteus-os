// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Toast } from './Toast';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

describe('Toast', () => {
  it('renders message correctly', () => {
    render(<Toast type="success" message="Success message" />);
    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const handleClose = vi.fn();
    render(<Toast type="success" message="Success" onClose={handleClose} />);
    const button = screen.getByRole('button');
    await userEvent.click(button);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
