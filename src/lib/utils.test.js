import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isExternalUrl, escapeHtml, renderTextWithLinks, formatPostDate } from './utils.js';

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
