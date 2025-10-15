import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import LoginForm from './LoginForm.svelte';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock;

// Mock AtpAgent
vi.mock('@atproto/api', () => {
  return {
    AtpAgent: vi.fn().mockImplementation(() => {
      return {
        login: vi.fn(),
        session: null,
      };
    }),
  };
});

describe('LoginForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render login form with handle and password inputs', () => {
    render(LoginForm);
    expect(screen.getByLabelText(/Bluesky Handle/i)).toBeTruthy();
    expect(screen.getByLabelText(/App Password/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Login/i })).toBeTruthy();
  });

  it('should have required attribute on inputs', () => {
    render(LoginForm);
    const handleInput = screen.getByLabelText(/Bluesky Handle/i);
    const passwordInput = screen.getByLabelText(/App Password/i);
    expect(handleInput.getAttribute('required')).not.toBeNull();
    expect(passwordInput.getAttribute('required')).not.toBeNull();
  });

  it('should have correct input types', () => {
    render(LoginForm);
    const handleInput = screen.getByLabelText(/Bluesky Handle/i);
    const passwordInput = screen.getByLabelText(/App Password/i);
    expect(handleInput.getAttribute('type')).toBe('text');
    expect(passwordInput.getAttribute('type')).toBe('password');
  });

  it('should display title and description', () => {
    render(LoginForm);
    expect(screen.getByText('Bluesky Client')).toBeTruthy();
    expect(screen.getByText('Log in to view your feed.')).toBeTruthy();
  });

  it('should have a link to App Password settings', () => {
    const { container } = render(LoginForm);
    const link = container.querySelector('a[href*="app-passwords"]');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toContain('app-passwords');
  });

  it('should update input values when typing', async () => {
    render(LoginForm);
    const handleInput = screen.getByLabelText(/Bluesky Handle/i);
    const passwordInput = screen.getByLabelText(/App Password/i);

    await fireEvent.input(handleInput, { target: { value: 'test.bsky.social' } });
    await fireEvent.input(passwordInput, { target: { value: 'test-password' } });

    expect(handleInput.value).toBe('test.bsky.social');
    expect(passwordInput.value).toBe('test-password');
  });

  it('should show login button with correct initial state', () => {
    render(LoginForm);
    const button = screen.getByRole('button', { name: /Login/i });
    expect(button.disabled).toBe(false);
    expect(screen.getByText('Login')).toBeTruthy();
  });
});
