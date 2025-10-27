import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import ThreadModal from './ThreadModal.svelte';

describe('ThreadModal Component', () => {
  it('should not render when open is false', () => {
    const { container } = render(ThreadModal, {
      props: {
        open: false,
        postUri: 'at://did:plc:test/app.bsky.feed.post/test',
        agent: {},
      },
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('should render when open is true', () => {
    const mockAgent = {
      getPostThread: vi.fn().mockResolvedValue({
        data: {
          thread: {
            post: {
              uri: 'at://did:plc:test/app.bsky.feed.post/test',
              author: {
                handle: 'testuser.bsky.social',
                displayName: 'Test User',
              },
              record: {
                text: 'Test post',
                createdAt: '2024-01-01T00:00:00Z',
              },
            },
          },
        },
      }),
    };

    render(ThreadModal, {
      props: {
        open: true,
        postUri: 'at://did:plc:test/app.bsky.feed.post/test',
        agent: mockAgent,
      },
    });

    expect(screen.getByText('Thread')).toBeTruthy();
  });

  it('should show loading state while fetching thread', () => {
    const mockAgent = {
      getPostThread: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                data: {
                  thread: {
                    post: {
                      uri: 'at://did:plc:test/app.bsky.feed.post/test',
                      author: {
                        handle: 'testuser.bsky.social',
                        displayName: 'Test User',
                      },
                      record: {
                        text: 'Test post',
                        createdAt: '2024-01-01T00:00:00Z',
                      },
                    },
                  },
                },
              });
            }, 100);
          }),
      ),
    };

    const { container } = render(ThreadModal, {
      props: {
        open: true,
        postUri: 'at://did:plc:test/app.bsky.feed.post/test',
        agent: mockAgent,
      },
    });

    // Should show loading spinner
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  it('should display thread posts after loading', async () => {
    const mockAgent = {
      getPostThread: vi.fn().mockResolvedValue({
        data: {
          thread: {
            post: {
              uri: 'at://did:plc:test/app.bsky.feed.post/test',
              author: {
                handle: 'testuser.bsky.social',
                displayName: 'Test User',
                avatar: 'https://example.com/avatar.jpg',
              },
              record: {
                text: 'Test post content',
                createdAt: '2024-01-01T00:00:00Z',
              },
            },
          },
        },
      }),
    };

    render(ThreadModal, {
      props: {
        open: true,
        postUri: 'at://did:plc:test/app.bsky.feed.post/test',
        agent: mockAgent,
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeTruthy();
      expect(screen.getByText('Test post content')).toBeTruthy();
    });
  });

  it('should display error message on thread fetch failure', async () => {
    const mockAgent = {
      getPostThread: vi.fn().mockRejectedValue(new Error('Failed to fetch')),
    };

    render(ThreadModal, {
      props: {
        open: true,
        postUri: 'at://did:plc:test/app.bsky.feed.post/test',
        agent: mockAgent,
        onClose: vi.fn(),
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch/i)).toBeTruthy();
    });
  });

  it('should call onClose when close button is clicked', async () => {
    const mockOnClose = vi.fn();
    const mockAgent = {
      getPostThread: vi.fn().mockResolvedValue({
        data: {
          thread: {
            post: {
              uri: 'at://did:plc:test/app.bsky.feed.post/test',
              author: {
                handle: 'testuser.bsky.social',
                displayName: 'Test User',
              },
              record: {
                text: 'Test post',
                createdAt: '2024-01-01T00:00:00Z',
              },
            },
          },
        },
      }),
    };

    render(ThreadModal, {
      props: {
        open: true,
        postUri: 'at://did:plc:test/app.bsky.feed.post/test',
        agent: mockAgent,
        onClose: mockOnClose,
      },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Close')).toBeTruthy();
    });

    const closeButton = screen.getByLabelText('Close');
    closeButton.click();

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should display multiple thread posts', async () => {
    const mockAgent = {
      getPostThread: vi.fn().mockResolvedValue({
        data: {
          thread: {
            parent: {
              post: {
                uri: 'at://did:plc:test/app.bsky.feed.post/parent',
                author: {
                  handle: 'testuser.bsky.social',
                  displayName: 'Test User',
                },
                record: {
                  text: 'Parent post',
                  createdAt: '2024-01-01T00:00:00Z',
                },
              },
            },
            post: {
              uri: 'at://did:plc:test/app.bsky.feed.post/test',
              author: {
                handle: 'testuser.bsky.social',
                displayName: 'Test User',
              },
              record: {
                text: 'Current post',
                createdAt: '2024-01-01T00:00:01Z',
              },
            },
            replies: [
              {
                post: {
                  uri: 'at://did:plc:test/app.bsky.feed.post/reply',
                  author: {
                    handle: 'testuser.bsky.social',
                    displayName: 'Test User',
                  },
                  record: {
                    text: 'Reply post',
                    createdAt: '2024-01-01T00:00:02Z',
                  },
                },
              },
            ],
          },
        },
      }),
    };

    render(ThreadModal, {
      props: {
        open: true,
        postUri: 'at://did:plc:test/app.bsky.feed.post/test',
        agent: mockAgent,
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Parent post')).toBeTruthy();
      expect(screen.getByText('Current post')).toBeTruthy();
      expect(screen.getByText('Reply post')).toBeTruthy();
    });
  });

  it('should handle thread with no posts', async () => {
    const mockAgent = {
      getPostThread: vi.fn().mockResolvedValue({
        data: {
          thread: null,
        },
      }),
    };

    render(ThreadModal, {
      props: {
        open: true,
        postUri: 'at://did:plc:test/app.bsky.feed.post/test',
        agent: mockAgent,
      },
    });

    await waitFor(() => {
      expect(screen.getByText('No posts found in thread.')).toBeTruthy();
    });
  });
});
