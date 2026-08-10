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

  it('calls onClose when close button is clicked', async () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} title="Test Modal" onClose={handleClose}>
        Content
      </Modal>
    );
    const buttons = screen.getAllByRole('button');
    await userEvent.click(buttons[0]); // First button is usually the backdrop or X icon, let's just find the close by role or text.
    // X icon doesn't have text, but the secondary button has "Hủy"
    const cancelBtn = screen.getByText('Hủy');
    await userEvent.click(cancelBtn);
    expect(handleClose).toHaveBeenCalled();
  });
});
