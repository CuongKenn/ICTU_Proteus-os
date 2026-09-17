// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Modal } from './Modal';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

describe('Modal', () => {
  it('renders nothing when not open', () => {
    const { container } = render(
      <Modal isOpen={false} title="Test Modal" onClose={() => {}}>
        Content
      </Modal>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders content when open', () => {
    render(
      <Modal isOpen={true} title="Test Modal" onClose={() => {}}>
        Content
      </Modal>
    );
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', async () => {
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();
    render(
      <Modal isOpen={true} title="Test Modal" onClose={handleClose} onConfirm={handleConfirm}>
        Content
      </Modal>
    );
    // Footer renders "Hủy" button only when onConfirm is provided
    const cancelBtn = screen.getByText('Hủy');
    await userEvent.click(cancelBtn);
    expect(handleClose).toHaveBeenCalled();
  });
});
