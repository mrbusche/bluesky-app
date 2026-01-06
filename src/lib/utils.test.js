import { beforeEach, describe, expect, it, vi } from 'vitest';
import { escapeHtml, formatPostDate, isExternalUrl, renderTextWithLinks, sharePost } from './utils.js';

describe('isExternalUrl', () => {
  it('should return true for http URLs', () => {
    expect(isExternalUrl('http://example.com')).toBe(true);
  });

  it('should return true for https URLs', () => {
    expect(isExternalUrl('https://example.com')).toBe(true);
  });

  it('should return true for protocol-relative URLs', () => {
    expect(isExternalUrl('//example.com')).toBe(true);
  });

  it('should return false for relative URLs', () => {
    expect(isExternalUrl('/path/to/page')).toBe(false);
  });

  it('should return false for internal URLs', () => {
    expect(isExternalUrl('#section')).toBe(false);
  });

  it('should return false for empty or null URLs', () => {
    expect(isExternalUrl('')).toBe(false);
    expect(isExternalUrl(null)).toBe(false);
  });
});

describe('escapeHtml', () => {
  it('should escape ampersands', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  it('should escape less than signs', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
  });

  it('should escape quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
    expect(escapeHtml("'hello'")).toBe('&#039;hello&#039;');
  });

  it('should handle empty strings', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(null)).toBe('');
  });

  it('should escape multiple special characters', () => {
    expect(escapeHtml('<script>alert("XSS")</script>')).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
  });
});

describe('renderTextWithLinks', () => {
  it('should return escaped text when no facets provided', () => {
    const text = 'Hello world';
    expect(renderTextWithLinks(text)).toBe('Hello world');
  });

  it('should replace newlines with <br>', () => {
    const text = 'Line 1\nLine 2';
    expect(renderTextWithLinks(text)).toBe('Line 1<br>Line 2');
  });

  it('should escape HTML in plain text', () => {
    const text = '<script>alert("XSS")</script>';
    expect(renderTextWithLinks(text)).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
  });

  it('should render links from facets', () => {
    const text = 'Check out example.com';
    const facets = [
      {
        index: { byteStart: 10, byteEnd: 21 },
        features: [
          {
            $type: 'app.bsky.richtext.facet#link',
            uri: 'https://example.com',
          },
        ],
      },
    ];
    const result = renderTextWithLinks(text, facets);
    expect(result).toContain('<a href="https://example.com"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
    expect(result).toContain('example.com</a>');
  });

  it('should handle empty facets array', () => {
    const text = 'Hello world';
    expect(renderTextWithLinks(text, [])).toBe('Hello world');
  });

  it('should handle null or undefined text', () => {
    expect(renderTextWithLinks(null)).toBe('');
    expect(renderTextWithLinks('')).toBe('');
  });

  it('should render mentions from facets', () => {
    const text = 'Hello @alice.bsky.social how are you?';
    const facets = [
      {
        index: { byteStart: 6, byteEnd: 24 },
        features: [
          {
            $type: 'app.bsky.richtext.facet#mention',
            did: 'did:plc:1234567890',
          },
        ],
      },
    ];
    const result = renderTextWithLinks(text, facets);
    expect(result).toContain('data-mention-did="did:plc:1234567890"');
    expect(result).toContain('class="text-blue-400 hover:underline cursor-pointer"');
    expect(result).toContain('@alice.bsky.social');
  });

  it('should handle both links and mentions in same text', () => {
    const text = 'Hey @bob check out example.com';
    const facets = [
      {
        index: { byteStart: 4, byteEnd: 8 },
        features: [
          {
            $type: 'app.bsky.richtext.facet#mention',
            did: 'did:plc:bob123',
          },
        ],
      },
      {
        index: { byteStart: 19, byteEnd: 30 },
        features: [
          {
            $type: 'app.bsky.richtext.facet#link',
            uri: 'https://example.com',
          },
        ],
      },
    ];
    const result = renderTextWithLinks(text, facets);
    expect(result).toContain('data-mention-did="did:plc:bob123"');
    expect(result).toContain('<a href="https://example.com"');
  });

  it('should escape HTML in mention text', () => {
    const text = 'Hello @<script>alert("xss")</script>';
    const facets = [
      {
        index: { byteStart: 6, byteEnd: 36 },
        features: [
          {
            $type: 'app.bsky.richtext.facet#mention',
            did: 'did:plc:test',
          },
        ],
      },
    ];
    const result = renderTextWithLinks(text, facets);
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('<script>');
  });
});

describe('formatPostDate', () => {
  beforeEach(() => {
    // Mock the current date to ensure consistent tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  it('should format recent posts in minutes', () => {
    const date = new Date('2024-01-15T11:30:00Z').toISOString();
    expect(formatPostDate(date)).toBe('30m');
  });

  it('should format posts from hours ago', () => {
    const date = new Date('2024-01-15T09:00:00Z').toISOString();
    expect(formatPostDate(date)).toBe('3h');
  });

  it('should format posts from days ago', () => {
    const date = new Date('2024-01-13T12:00:00Z').toISOString();
    expect(formatPostDate(date)).toBe('2d');
  });

  it('should format older posts with full date', () => {
    const date = new Date('2023-11-01T12:00:00Z').toISOString();
    expect(formatPostDate(date)).toBe('11/1/2023');
  });

  it('should handle posts from exactly 24 hours ago', () => {
    const date = new Date('2024-01-14T12:00:00Z').toISOString();
    expect(formatPostDate(date)).toBe('1d');
  });
});

describe('sharePost', () => {
  const mockPost = {
    uri: 'at://did:plc:abc123/app.bsky.feed.post/xyz789',
    author: {
      handle: 'testuser.bsky.social',
      displayName: 'Test User',
    },
    record: {
      text: 'This is a test post',
    },
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Clean up navigator mocks
    delete global.navigator;
    global.navigator = {};
  });

  it('should use Web Share API when available', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    global.navigator.share = shareMock;

    const result = await sharePost(mockPost);

    expect(result).toEqual({ success: true, method: 'share' });
    expect(shareMock).toHaveBeenCalledWith({
      title: 'Post by Test User',
      text: 'This is a test post\n\n',
      url: 'https://bsky.app/profile/testuser.bsky.social/post/xyz789',
    });
  });

  it('should return false when user cancels Web Share', async () => {
    const error = new Error('User cancelled');
    error.name = 'AbortError';
    const shareMock = vi.fn().mockRejectedValue(error);
    global.navigator.share = shareMock;

    const result = await sharePost(mockPost);

    expect(result).toEqual({ success: false, method: null });
    expect(shareMock).toHaveBeenCalled();
  });

  it('should fallback to clipboard when Web Share API is not available', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    global.navigator.clipboard = {
      writeText: writeTextMock,
    };

    const result = await sharePost(mockPost);

    expect(result).toEqual({ success: true, method: 'clipboard' });
    expect(writeTextMock).toHaveBeenCalledWith('This is a test post\n\nhttps://bsky.app/profile/testuser.bsky.social/post/xyz789');
  });

  it('should handle post without text', async () => {
    const postWithoutText = {
      ...mockPost,
      record: {},
    };
    const shareMock = vi.fn().mockResolvedValue(undefined);
    global.navigator.share = shareMock;

    const result = await sharePost(postWithoutText);

    expect(result).toEqual({ success: true, method: 'share' });
    expect(shareMock).toHaveBeenCalledWith({
      title: 'Post by Test User',
      text: '',
      url: 'https://bsky.app/profile/testuser.bsky.social/post/xyz789',
    });
  });

  it('should use handle when displayName is not available', async () => {
    const postWithoutDisplayName = {
      ...mockPost,
      author: {
        handle: 'testuser.bsky.social',
      },
    };
    const shareMock = vi.fn().mockResolvedValue(undefined);
    global.navigator.share = shareMock;

    await sharePost(postWithoutDisplayName);

    expect(shareMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Post by testuser.bsky.social',
      }),
    );
  });

  it('should return false when post is null', async () => {
    const result = await sharePost(null);
    expect(result).toEqual({ success: false, method: null });
  });

  it('should handle clipboard errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard not available'));
    global.navigator.clipboard = {
      writeText: writeTextMock,
    };

    const result = await sharePost(mockPost);

    expect(result).toEqual({ success: false, method: null });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Clipboard copy failed:', expect.any(Error));

    consoleErrorSpy.mockRestore();
  });

  it('should validate URI format and return false for malformed URIs', async () => {
    const invalidPost1 = {
      ...mockPost,
      uri: 'invalid-uri',
    };
    const result1 = await sharePost(invalidPost1);
    expect(result1).toEqual({ success: false, method: null });

    // Test URI without proper DID
    const invalidPost2 = {
      ...mockPost,
      uri: 'at://not-a-did/app.bsky.feed.post/xyz789',
    };
    const result2 = await sharePost(invalidPost2);
    expect(result2).toEqual({ success: false, method: null });

    // Test URI with too few parts
    const invalidPost3 = {
      ...mockPost,
      uri: 'at://did:plc:abc123',
    };
    const result3 = await sharePost(invalidPost3);
    expect(result3).toEqual({ success: false, method: null });
  });

  it('should fallback to clipboard when Web Share fails with non-AbortError', async () => {
    const shareMock = vi.fn().mockRejectedValue(new Error('Share failed'));
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    global.navigator.share = shareMock;
    global.navigator.clipboard = {
      writeText: writeTextMock,
    };

    const result = await sharePost(mockPost);

    expect(result).toEqual({ success: true, method: 'clipboard' });
    expect(shareMock).toHaveBeenCalled();
    expect(writeTextMock).toHaveBeenCalled();
  });

  it('should validate post has required fields', async () => {
    const postWithoutAuthor = {
      uri: 'at://did:plc:abc123/app.bsky.feed.post/xyz789',
    };

    const result = await sharePost(postWithoutAuthor);

    expect(result).toEqual({ success: false, method: null });
  });
});
