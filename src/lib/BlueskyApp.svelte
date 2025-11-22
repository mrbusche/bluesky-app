<script>
  import { onMount, tick } from 'svelte';
  import UserProfileModal from './UserProfileModal.svelte';
  import LoginForm from './LoginForm.svelte';
  import FeedPost from './FeedPost.svelte';
  import { AtpAgent } from '@atproto/api';

  // --- Svelte State Management ---
  let agent = null;
  let session = null;

  // Raw posts from API (flat list for logic/seeking)
  let rawPosts = [];
  // Processed posts (grouped by thread for display)
  let displayItems = [];

  let timelineCursor = null;

  // UI State
  let isLoading = true;
  let isFetchingMore = false;
  let isRestoringScroll = false;

  // Profile view state
  let showProfile = false;
  let profileHandle = '';

  // --- Constants ---
  const BLUESKY_SERVICE = 'https://bsky.social';
  const LAST_VIEWED_POST_TIMESTAMP_KEY = 'blueskyLastViewedPostTimestamp';
  const LAST_VIEWED_POST_URI_KEY = 'blueskyLastViewedPostUri';
  const SESSION_KEY = 'blueskySession';

  // --- Lifecycle & Initialization ---
  onMount(async () => {
    const savedSession = localStorage.getItem(SESSION_KEY);

    if (savedSession) {
      agent = new AtpAgent({ service: BLUESKY_SERVICE });
      try {
        const sessionData = JSON.parse(savedSession);
        await agent.resumeSession(sessionData);
        session = agent.session;
        console.log('Session resumed successfully.');
        await fetchTimeline();
        await restoreScrollPosition();
      } catch (error) {
        console.error('Failed to resume session:', error);
        localStorage.removeItem(SESSION_KEY);
        session = null;
      }
    }
    isLoading = false;
  });

  // --- Feed Processing (Thread Grouping) ---
  function processFeed(posts) {
    const items = [];
    let i = 0;

    while (i < posts.length) {
      const current = posts[i];
      const thread = [current];
      let j = i + 1;

      // Check for chain of self-replies (Newest -> Oldest)
      while (j < posts.length) {
        const next = posts[j];
        const prevInGroup = thread[thread.length - 1];

        const sameAuthor = prevInGroup.post.author.did === next.post.author.did;
        const isReplyToNext = prevInGroup.reply?.parent?.uri === next.post.uri;

        if (sameAuthor && isReplyToNext) {
          thread.push(next);
          j++;
        } else {
          break;
        }
      }

      if (thread.length > 1) {
        items.push({ type: 'threadGroup', items: thread });
        i = j;
      } else {
        items.push({ type: 'post', item: current });
        i++;
      }
    }
    return items;
  }

  // --- Core Functions ---
  async function handleLoginSuccess({ agent: newAgent, session: newSession }) {
    agent = newAgent;
    session = newSession;
    try {
      await fetchTimeline();
      await restoreScrollPosition();
    } catch (error) {
      console.error('Error during login success handling:', error);
    }
  }

  function handleLogout() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LAST_VIEWED_POST_TIMESTAMP_KEY);
    localStorage.removeItem(LAST_VIEWED_POST_URI_KEY);
    session = null;
    rawPosts = [];
    displayItems = [];
    timelineCursor = null;
    window.location.reload();
  }

  async function fetchTimeline() {
    if (isFetchingMore || !session) return;
    isFetchingMore = true;

    try {
      const params = { limit: 30 };
      if (timelineCursor) {
        params.cursor = timelineCursor;
      }

      const response = await agent.getTimeline(params);
      if (response.data.feed.length > 0) {
        const newPosts = response.data.feed.filter((item) => {
          if (!item.post) return false;
          if (!item.post.record.reply) return true;
          const parentAuthorDid = item.reply?.parent?.author?.did;
          if (parentAuthorDid !== null && parentAuthorDid !== undefined) {
            return item.post.author.did === parentAuthorDid;
          }
          return false;
        });

        rawPosts = [...rawPosts, ...newPosts];
        displayItems = processFeed(rawPosts);
        timelineCursor = response.data.cursor;
      } else {
        timelineCursor = null;
      }
    } catch (error) {
      const status = error?.response?.status || error?.status;
      console.error('Failed to fetch timeline:', { error, status, timelineCursor });
      if (status === 401) {
        localStorage.removeItem(SESSION_KEY);
        session = null;
        window.location.reload();
      }
    } finally {
      isFetchingMore = false;
    }
  }

  // --- Scroll Handling ---
  let scrollSaveTimeout;
  function saveScrollPosition() {
    if (scrollSaveTimeout) clearTimeout(scrollSaveTimeout);
    scrollSaveTimeout = setTimeout(() => {
      const header = document.querySelector('header');
      const headerHeight = header ? header.offsetHeight : 0;

      const firstVisiblePost = Array.from(document.querySelectorAll('main article')).find(
        (el) => el.getBoundingClientRect().bottom > headerHeight,
      );

      if (firstVisiblePost) {
        const postUri = firstVisiblePost.id;
        localStorage.setItem(LAST_VIEWED_POST_URI_KEY, postUri);

        const post = rawPosts.find((item) => item.post.uri === postUri);
        if (post?.post?.record?.createdAt) {
          const timestamp = new Date(post.post.record.createdAt).getTime();
          localStorage.setItem(LAST_VIEWED_POST_TIMESTAMP_KEY, timestamp.toString());
        }
      }
    }, 250);
  }

  async function restoreScrollPosition() {
    const savedUri = localStorage.getItem(LAST_VIEWED_POST_URI_KEY);
    if (savedUri) {
      isRestoringScroll = true;
      try {
        let elementToRestore = null;
        let attempts = 0;
        const MAX_FETCH_ATTEMPTS = 10;

        while (!elementToRestore && timelineCursor && attempts < MAX_FETCH_ATTEMPTS) {
          await tick();
          elementToRestore = document.getElementById(savedUri);
          if (!elementToRestore) {
            console.log(`Post ${savedUri} not found, fetching more...`);
            await fetchTimeline();
            attempts++;
          }
        }

        if (elementToRestore) {
          const header = document.querySelector('header');
          const headerHeight = header ? header.offsetHeight : 0;
          elementToRestore.scrollIntoView({ behavior: 'auto', block: 'start' });
          if (headerHeight > 0) {
            window.scrollBy(0, -headerHeight - 16);
          }
          isRestoringScroll = false;
          return;
        }
      } catch (error) {
        console.error('Error during URI-based scroll restoration:', error);
      }
    }

    // Fallback to timestamp-based approach
    const savedTimestamp = localStorage.getItem(LAST_VIEWED_POST_TIMESTAMP_KEY);
    if (!savedTimestamp) {
      isRestoringScroll = false;
      return;
    }

    const targetTimestamp = parseInt(savedTimestamp, 10);

    try {
      let closestPost = null;
      let attempts = 0;
      const MAX_FETCH_ATTEMPTS = 10;

      const findClosestPost = () => {
        let closest = null;
        let minDiff = Infinity;
        for (const item of rawPosts) {
          if (item.post?.record?.createdAt) {
            const postTimestamp = new Date(item.post.record.createdAt).getTime();
            const diff = Math.abs(postTimestamp - targetTimestamp);
            if (diff < minDiff) {
              minDiff = diff;
              closest = item;
            }
            if (diff === 0) break;
          }
        }
        return closest;
      };

      while (attempts < MAX_FETCH_ATTEMPTS) {
        await tick();
        closestPost = findClosestPost();

        if (closestPost) {
          const closestTimestamp = new Date(closestPost.post.record.createdAt).getTime();
          if (closestTimestamp === targetTimestamp) {
            break;
          }
          if (closestTimestamp > targetTimestamp && timelineCursor) {
            await fetchTimeline();
            attempts++;
          } else {
            break;
          }
        } else if (timelineCursor) {
          await fetchTimeline();
          attempts++;
        } else {
          break;
        }
      }

      if (closestPost) {
        await tick();
        const elementToRestore = document.getElementById(closestPost.post.uri);
        if (elementToRestore) {
          const header = document.querySelector('header');
          const headerHeight = header ? header.offsetHeight : 0;
          elementToRestore.scrollIntoView({ behavior: 'auto', block: 'start' });
          if (headerHeight > 0) {
            window.scrollBy(0, -headerHeight - 16);
          }
        }
      } else {
        localStorage.removeItem(LAST_VIEWED_POST_URI_KEY);
        localStorage.removeItem(LAST_VIEWED_POST_TIMESTAMP_KEY);
      }
    } catch (error) {
      console.error('Error during timestamp-based scroll restoration:', error);
    } finally {
      isRestoringScroll = false;
    }
  }

  function handleInfiniteScroll() {
    if (window.innerHeight + window.scrollY >= document.documentElement.offsetHeight - 500) {
      if (!isFetchingMore && timelineCursor) {
        fetchTimeline();
      }
    }
    saveScrollPosition();
  }

  function showUserProfile(userHandle) {
    profileHandle = userHandle;
    showProfile = true;
  }
  function closeProfile() {
    showProfile = false;
    profileHandle = '';
  }

  // openThread/closeThread removed

  async function toggleLike(event) {
    if (!session) return;
    const { item } = event.detail;
    const post = item.post;
    const isLiked = post.viewer?.like;

    const updatePostInList = (list, targetUri, changes) => {
      return list.map((entry) => {
        if (entry.post.uri === targetUri) {
          return { ...entry, post: { ...entry.post, ...changes } };
        }
        return entry;
      });
    };

    try {
      if (isLiked) {
        await agent.deleteLike(post.viewer.like);
        rawPosts = updatePostInList(rawPosts, post.uri, {
          likeCount: (post.likeCount || 1) - 1,
          viewer: { ...post.viewer, like: undefined },
        });
      } else {
        const response = await agent.like(post.uri, post.cid);
        rawPosts = updatePostInList(rawPosts, post.uri, {
          likeCount: (post.likeCount || 0) + 1,
          viewer: { ...post.viewer, like: response.uri },
        });
      }
      displayItems = processFeed(rawPosts);
    } catch (error) {
      console.error('Like/unlike error:', error);
    }
  }
</script>

<svelte:window on:scroll={handleInfiniteScroll} />

{#if isRestoringScroll}
  <div class="fixed bottom-4 right-4 bg-gray-700 text-white py-2 px-4 rounded-lg shadow-lg z-20 flex items-center space-x-2">
    <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
    <span>Restoring position...</span>
  </div>
{/if}

<UserProfileModal open={showProfile} handle={profileHandle} {agent} {session} onClose={closeProfile} />

<div class="max-w-2xl mx-auto font-sans">
  {#if isLoading && !session}
    <div class="min-h-screen flex items-center justify-center">
      <div class="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
    </div>
  {:else if session}
    <div>
      <header class="sticky top-0 bg-gray-900 bg-opacity-80 backdrop-blur-md z-10 border-b border-gray-700">
        <div class="flex justify-between items-center p-4">
          <h1 class="text-xl font-bold text-blue-400">Your Feed</h1>
          <button
            on:click={handleLogout}
            class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md text-sm transition duration-150 ease-in-out"
          >
            Logout
          </button>
        </div>
      </header>

      <main>
        {#each displayItems as entry}
          {#if entry.type === 'threadGroup'}
            <div class="border-b border-gray-700 bg-gray-800/30">
              <FeedPost
                item={entry.items[entry.items.length - 1]}
                on:like={toggleLike}
                on:profile={(e) => showUserProfile(e.detail.handle)}
              />

              <a
                href="/thread/{encodeURIComponent(entry.items[0].post.uri)}"
                class="block pl-16 py-2 hover:bg-gray-800 cursor-pointer flex items-center text-blue-400 text-sm font-semibold transition-colors relative"
              >
                <div class="w-0.5 h-full bg-gray-600 absolute left-10 top-0 bottom-0"></div>
                <span class="ml-2">Show full thread ({entry.items.length} posts)</span>
              </a>

              <FeedPost item={entry.items[0]} on:like={toggleLike} on:profile={(e) => showUserProfile(e.detail.handle)} />
            </div>
          {:else}
            <FeedPost item={entry.item} on:like={toggleLike} on:profile={(e) => showUserProfile(e.detail.handle)} />
          {/if}
        {/each}
      </main>

      {#if isFetchingMore}
        <div class="flex justify-center items-center py-8">
          <div class="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      {/if}

      {#if !timelineCursor && displayItems.length > 0 && !isFetchingMore}
        <p class="text-center text-gray-500 py-8">End of feed.</p>
      {/if}
    </div>
  {:else}
    <LoginForm onLoginSuccess={handleLoginSuccess} />
  {/if}
</div>

<style>
  :global(body) {
    background-color: #1a202c;
    color: #e2e8f0;
  }
  ::-webkit-scrollbar {
    width: 8px;
  }
  ::-webkit-scrollbar-track {
    background: #1a202c;
  }
  ::-webkit-scrollbar-thumb {
    background: #4a5568;
    border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #718096;
  }
</style>
