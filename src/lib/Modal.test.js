import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Modal from './Modal.svelte';

describe('Modal Component', () => {
  let closeMock;

  beforeEach(() => {
    closeMock = vi.fn();
  });

  afterEach(() => {
    // Clean up body class after each test
    document.body.classList.remove('modal-open');
  });

  it('should not render when open is false', () => {
    const { container } = render(Modal, { props: { open: false } });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('should render when open is true', () => {
    render(Modal, { props: { open: true, close: closeMock } });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
  });

  it('should call close when overlay is clicked and closeOnOverlay is true', async () => {
    const { container } = render(Modal, {
      props: { open: true, close: closeMock, closeOnOverlay: true },
    });
    const overlay = container.querySelector('.fixed');
    await fireEvent.click(overlay);
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('should not call close when overlay is clicked and closeOnOverlay is false', async () => {
    const { container } = render(Modal, {
      props: { open: true, close: closeMock, closeOnOverlay: false },
    });
    const overlay = container.querySelector('.fixed');
    await fireEvent.click(overlay);
    expect(closeMock).not.toHaveBeenCalled();
  });

  it('should call close when Escape key is pressed and closeOnEsc is true', async () => {
    render(Modal, {
      props: { open: true, close: closeMock, closeOnEsc: true },
    });
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('should not call close when Escape key is pressed and closeOnEsc is false', async () => {
    render(Modal, {
      props: { open: true, close: closeMock, closeOnEsc: false },
    });
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(closeMock).not.toHaveBeenCalled();
  });

  it('should add modal-open class to body when open', () => {
    render(Modal, { props: { open: true, close: closeMock } });
    expect(document.body.classList.contains('modal-open')).toBe(true);
  });

  it('should remove modal-open class from body when component is unmounted', () => {
    const { unmount } = render(Modal, { props: { open: true, close: closeMock } });
    expect(document.body.classList.contains('modal-open')).toBe(true);

    unmount();
    expect(document.body.classList.contains('modal-open')).toBe(false);
  });

  it('should use default containerClass', () => {
    render(Modal, {
      props: { open: true, close: closeMock },
    });
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('class')).toBe('bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6');
  });

  it('should have correct aria-label attribute', () => {
    render(Modal, { props: { open: true, close: closeMock } });
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-label')).toBe('Dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });
});
