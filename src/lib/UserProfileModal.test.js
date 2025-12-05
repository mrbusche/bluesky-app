import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UserProfileModal from './UserProfileModal.svelte';

describe('UserProfileModal Component', () => {
  let mockAgent;
  let mockSession;

  beforeEach(() => {
    // Create mock agent with methods
    mockAgent = {
      getProfile: vi.fn(),
      follow: vi.fn(),
      deleteFollow: vi.fn(),
    };

    mockSession = {
      did: 'did:plc:test123',
      handle: 'test.bsky.social',
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.body.classList.remove('modal-open');
  });

  it('should not render when open is false', () => {
    const { container } = render(UserProfileModal, {
      props: { open: false, handle: 'test.bsky.social', agent: mockAgent },
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('should render when open is true', () => {
    render(UserProfileModal, {
      props: { open: true, handle: 'test.bsky.social', agent: mockAgent },
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('should display loading state while fetching profile', () => {
    mockAgent.getProfile.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 1000)));

    render(UserProfileModal, {
      props: { open: true, handle: 'test.bsky.social', agent: mockAgent },
    });

    expect(screen.getByRole('dialog')).toBeTruthy();
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  it('should display profile data after successful fetch', async () => {
    const mockProfile = {
      handle: 'test.bsky.social',
      displayName: 'Test User',
      description: 'Test bio',
      followersCount: 100,
      followsCount: 50,
      postsCount: 25,
      avatar: 'https://example.com/avatar.jpg',
    };

    mockAgent.getProfile.mockResolvedValue({ data: mockProfile });

    render(UserProfileModal, {
      props: { open: true, handle: 'test.bsky.social', agent: mockAgent },
    });

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeTruthy();
    });

    expect(screen.getByText('@test.bsky.social')).toBeTruthy();
    expect(screen.getByText('Test bio')).toBeTruthy();
    expect(screen.getByText(/100/)).toBeTruthy(); // followers
    expect(screen.getByText(/50/)).toBeTruthy(); // following
    expect(screen.getByText(/25/)).toBeTruthy(); // posts
  });

  it('should display error message on profile fetch failure', async () => {
    mockAgent.getProfile.mockRejectedValue(new Error('Failed to fetch'));

    render(UserProfileModal, {
      props: { open: true, handle: 'test.bsky.social', agent: mockAgent },
    });

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch/i)).toBeTruthy();
    });
  });

  it('should display follow button when user is not following', async () => {
    const mockProfile = {
      handle: 'test.bsky.social',
      displayName: 'Test User',
      followersCount: 100,
      followsCount: 50,
      postsCount: 25,
      viewer: { following: undefined },
    };

    mockAgent.getProfile.mockResolvedValue({ data: mockProfile });

    render(UserProfileModal, {
      props: { open: true, handle: 'test.bsky.social', agent: mockAgent, session: mockSession },
    });

    await waitFor(() => {
      expect(screen.getByText('Follow')).toBeTruthy();
    });
  });

  it('should display following button when user is already following', async () => {
    const mockProfile = {
      handle: 'test.bsky.social',
      displayName: 'Test User',
      followersCount: 100,
      followsCount: 50,
      postsCount: 25,
      viewer: { following: 'at://did:plc:test/app.bsky.graph.follow/123' },
    };

    mockAgent.getProfile.mockResolvedValue({ data: mockProfile });

    render(UserProfileModal, {
      props: { open: true, handle: 'test.bsky.social', agent: mockAgent, session: mockSession },
    });

    await waitFor(() => {
      expect(screen.getByText('Following')).toBeTruthy();
    });
  });

  it('should not show follow button when session is not provided', async () => {
    const mockProfile = {
      handle: 'test.bsky.social',
      displayName: 'Test User',
      followersCount: 100,
      followsCount: 50,
      postsCount: 25,
    };

    mockAgent.getProfile.mockResolvedValue({ data: mockProfile });

    render(UserProfileModal, {
      props: { open: true, handle: 'test.bsky.social', agent: mockAgent, session: null },
    });

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeTruthy();
    });

    expect(screen.queryByText('Follow')).toBeNull();
    expect(screen.queryByText('Following')).toBeNull();
  });

  it('should have close button', () => {
    render(UserProfileModal, {
      props: { open: true, handle: 'test.bsky.social', agent: mockAgent },
    });

    const closeButton = screen.getByLabelText('Close');
    expect(closeButton).toBeTruthy();
  });

  it('should call onClose when close button is clicked', async () => {
    const onCloseMock = vi.fn();

    render(UserProfileModal, {
      props: { open: true, handle: 'test.bsky.social', agent: mockAgent, onClose: onCloseMock },
    });

    const closeButton = screen.getByLabelText('Close');
    await fireEvent.click(closeButton);

    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
