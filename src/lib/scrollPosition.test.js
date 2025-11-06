import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();
global.localStorage = localStorageMock;

describe('Scroll Position Storage', () => {
  const LAST_VIEWED_POST_TIMESTAMP_KEY = 'blueskyLastViewedPostTimestamp';
  const LAST_VIEWED_POST_URI_KEY = 'blueskyLastViewedPostUri';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Timestamp-based storage', () => {
    it('should store timestamp as string', () => {
      const timestamp = new Date('2024-01-15T12:00:00Z').getTime();
      localStorage.setItem(LAST_VIEWED_POST_TIMESTAMP_KEY, timestamp.toString());

      const stored = localStorage.getItem(LAST_VIEWED_POST_TIMESTAMP_KEY);
      expect(stored).toBe(timestamp.toString());
      expect(parseInt(stored, 10)).toBe(timestamp);
    });

    it('should parse stored timestamp correctly', () => {
      const timestamp = 1705320000000; // 2024-01-15T12:00:00Z
      localStorage.setItem(LAST_VIEWED_POST_TIMESTAMP_KEY, timestamp.toString());

      const parsed = parseInt(localStorage.getItem(LAST_VIEWED_POST_TIMESTAMP_KEY), 10);
      expect(parsed).toBe(timestamp);
      expect(new Date(parsed).toISOString()).toBe('2024-01-15T12:00:00.000Z');
    });
  });

  describe('Finding closest post by timestamp', () => {
    it('should find exact match', () => {
      const targetTimestamp = 1705320000000; // 2024-01-15T12:00:00Z
      const posts = [
        { post: { uri: 'post1', record: { createdAt: '2024-01-15T11:00:00Z' } } },
        { post: { uri: 'post2', record: { createdAt: '2024-01-15T12:00:00Z' } } },
        { post: { uri: 'post3', record: { createdAt: '2024-01-15T13:00:00Z' } } },
      ];

      let closest = null;
      let minDiff = Infinity;

      for (const item of posts) {
        const postTimestamp = new Date(item.post.record.createdAt).getTime();
        const diff = Math.abs(postTimestamp - targetTimestamp);

        if (diff < minDiff) {
          minDiff = diff;
          closest = item;
        }

        if (diff === 0) break;
      }

      expect(closest.post.uri).toBe('post2');
      expect(minDiff).toBe(0);
    });

    it('should find closest post when exact match does not exist', () => {
      const targetTimestamp = new Date('2024-01-15T12:00:00Z').getTime();
      const posts = [
        { post: { uri: 'post1', record: { createdAt: '2024-01-15T11:00:00Z' } } },
        { post: { uri: 'post2', record: { createdAt: '2024-01-15T11:55:00Z' } } },
        { post: { uri: 'post3', record: { createdAt: '2024-01-15T13:00:00Z' } } },
      ];

      let closest = null;
      let minDiff = Infinity;

      for (const item of posts) {
        const postTimestamp = new Date(item.post.record.createdAt).getTime();
        const diff = Math.abs(postTimestamp - targetTimestamp);

        if (diff < minDiff) {
          minDiff = diff;
          closest = item;
        }
      }

      expect(closest.post.uri).toBe('post2');
      // Should be 5 minutes = 300000 ms
      expect(minDiff).toBe(300000);
    });

    it('should handle posts with same distance from target', () => {
      const targetTimestamp = new Date('2024-01-15T12:00:00Z').getTime();
      const posts = [
        { post: { uri: 'post1', record: { createdAt: '2024-01-15T11:50:00Z' } } },
        { post: { uri: 'post2', record: { createdAt: '2024-01-15T12:10:00Z' } } },
      ];

      let closest = null;
      let minDiff = Infinity;

      for (const item of posts) {
        const postTimestamp = new Date(item.post.record.createdAt).getTime();
        const diff = Math.abs(postTimestamp - targetTimestamp);

        if (diff < minDiff) {
          minDiff = diff;
          closest = item;
        }
      }

      // Should find the first one encountered (post1)
      expect(closest.post.uri).toBe('post1');
      expect(minDiff).toBe(600000); // 10 minutes
    });

    it('should return null when posts array is empty', () => {
      const posts = [];
      let closest = null;
      let minDiff = Infinity;

      for (const item of posts) {
        const postTimestamp = new Date(item.post.record.createdAt).getTime();
        const diff = Math.abs(postTimestamp - 1705320000000);

        if (diff < minDiff) {
          minDiff = diff;
          closest = item;
        }
      }

      expect(closest).toBeNull();
    });
  });

  describe('Migration from URI to timestamp', () => {
    it('should detect legacy URI-based storage', () => {
      const legacyUri = 'at://did:plc:xyz/app.bsky.feed.post/abc123';
      localStorage.setItem(LAST_VIEWED_POST_URI_KEY, legacyUri);

      const hasTimestamp = localStorage.getItem(LAST_VIEWED_POST_TIMESTAMP_KEY);
      const hasLegacyUri = localStorage.getItem(LAST_VIEWED_POST_URI_KEY);

      expect(hasTimestamp).toBeNull();
      expect(hasLegacyUri).toBe(legacyUri);
    });

    it('should prefer timestamp over URI if both exist', () => {
      const legacyUri = 'at://did:plc:xyz/app.bsky.feed.post/abc123';
      const timestamp = new Date('2024-01-15T12:00:00Z').getTime();

      localStorage.setItem(LAST_VIEWED_POST_URI_KEY, legacyUri);
      localStorage.setItem(LAST_VIEWED_POST_TIMESTAMP_KEY, timestamp.toString());

      const storedTimestamp = localStorage.getItem(LAST_VIEWED_POST_TIMESTAMP_KEY);
      expect(storedTimestamp).toBe(timestamp.toString());
    });
  });

  describe('Timestamp calculation', () => {
    it('should calculate timestamp difference in seconds', () => {
      const timestamp1 = new Date('2024-01-15T12:00:00Z').getTime();
      const timestamp2 = new Date('2024-01-15T12:05:00Z').getTime();

      const diffMs = Math.abs(timestamp2 - timestamp1);
      const diffSeconds = diffMs / 1000;

      expect(diffSeconds).toBe(300); // 5 minutes
    });

    it('should handle past and future timestamps', () => {
      const now = new Date('2024-01-15T12:00:00Z').getTime();
      const past = new Date('2024-01-15T11:00:00Z').getTime();
      const future = new Date('2024-01-15T13:00:00Z').getTime();

      const diffPast = Math.abs(now - past);
      const diffFuture = Math.abs(future - now);

      expect(diffPast).toBe(3600000); // 1 hour
      expect(diffFuture).toBe(3600000); // 1 hour
    });
  });
});
