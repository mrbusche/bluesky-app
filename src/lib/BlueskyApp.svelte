<script>
  import { onMount, tick } from 'svelte';
  import EmbedRenderer from './EmbedRenderer.svelte';
  import UserProfileModal from './UserProfileModal.svelte';
  import ThreadModal from './ThreadModal.svelte';
  import LoginForm from './LoginForm.svelte';
  import { AtpAgent } from '@atproto/api';
  import { renderTextWithLinks, formatPostDate } from './utils.js';

  // --- Svelte State Management ---
  let agent = null;
  let session = null;
  let posts = [];
  let timelineCursor = null;

  // UI State
  let isLoading = true;
  let isFetchingMore = false;
  let isRestoringScroll = false;

  // Profile view state
  let showProfile = false;
  let profileHandle = '';

  // Thread view state
  let showThread = false;
  let threadPostUri = '';

  // --- Constants ---
  const BLUESKY_SERVICE = 'https://bsky.social';
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
        await fetchTimeline(); // Fetch the first page
        await restoreScrollPosition(); // Restore position, fetching more if needed
      } catch (error) {
        console.error('Failed to resume session:', error);
        localStorage.removeItem(SESSION_KEY);
        session = null;
      }
    }
    isLoading = false;
  });

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
    localStorage.removeItem(LAST_VIEWED_POST_URI_KEY);
    session = null;
    posts = [];
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
        // Filter out replies that are not self-replies (threaded posts)
        const newPosts = response.data.feed.filter((item) => {
          if (!item.post) return false;
          if (!item.post.record.reply) return true; // top-level post
          const parentAuthorDid = item.reply?.parent?.author?.did;
          if (parentAuthorDid !== null && parentAuthorDid !== undefined) {
            return item.post.author.did === parentAuthorDid;
          }
          return false;
        });

        // Filter to show only first and last posts of threads
        const filteredPosts = await filterThreadPosts(newPosts);
        posts = [...posts, ...filteredPosts];
        timelineCursor = response.data.cursor;
      } else {
        timelineCursor = null;
      }
    } catch (error) {
      const status = error?.response?.status || error?.status;
      console.error('Failed to fetch timeline:', { error, status, timelineCursor });
      if (status === 502 || status === 503 || status === 504) {
        console.error('Feed temporarily unavailable (server error). Retrying may work.');
      } else if (status === 401) {
        console.error('Session expired. Please log in again.');
        localStorage.removeItem(SESSION_KEY);
        session = null;
        window.location.reload();
      } else {
        console.error('Could not load feed.');
      }
    } finally {
      isFetchingMore = false;
    }
  }

  // Filter posts to show only first and last of thread chains
  async function filterThreadPosts(feedPosts) {
    const threadMap = new Map(); // Maps root URI to array of posts
    const standalonePost = []; // Non-thread posts

    // Group posts by thread
    for (const item of feedPosts) {
      if (!item.post.record.reply || !item.reply?.parent) {
        // Not a reply, it's a standalone post or thread root
        standalonePost.push(item);
      } else {
        // It's a self-reply, try to find the thread root
        const parentUri = item.reply.parent.uri;
        const rootUri = item.reply.root?.uri || parentUri;
        
        if (!threadMap.has(rootUri)) {
          threadMap.set(rootUri, []);
        }
        threadMap.get(rootUri).push(item);
      }
    }

    const result = [];
    
    // Add standalone posts
    result.push(...standalonePost);
    
    // For each thread, keep only first and last posts
    for (const [rootUri, threadPosts] of threadMap.entries()) {
      if (threadPosts.length === 1) {
        // Only one post in this thread segment, keep it
        result.push(threadPosts[0]);
      } else if (threadPosts.length === 2) {
        // Two posts, keep both (first and last)
        result.push(threadPosts[0], threadPosts[1]);
      } else {
        // More than 2 posts, keep only first and last
        result.push(threadPosts[0], threadPosts[threadPosts.length - 1]);
      }
    }

    return result;
  }

  // --- Scroll Handling ---
  let scrollSaveTimeout;

  function saveScrollPosition() {
    if (scrollSaveTimeout) clearTimeout(scrollSaveTimeout);
    scrollSaveTimeout = setTimeout(() => {
      const header = document.querySelector('header');
      const headerHeight = header ? header.offsetHeight : 0;

      const firstVisiblePost = Array.from(document.querySelectorAll('main > article')).find(
        (el) => el.getBoundingClientRect().bottom > headerHeight,
      );

      if (firstVisiblePost) {
        localStorage.setItem(LAST_VIEWED_POST_URI_KEY, firstVisiblePost.id);
      }
    }, 250);
  }

  async function restoreScrollPosition() {
    const savedUri = localStorage.getItem(LAST_VIEWED_POST_URI_KEY);
    if (!savedUri) return;

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
        console.log(`Post ${savedUri} found after ${attempts} fetches. Scrolling into view.`);
        const header = document.querySelector('header');
        const headerHeight = header ? header.offsetHeight : 0;
        elementToRestore.scrollIntoView({ behavior: 'auto', block: 'start' });
        if (headerHeight > 0) {
          window.scrollBy(0, -headerHeight - 16);
        }
      } else {
        console.warn(`Could not find post ${savedUri} after ${attempts} fetches. Clearing saved position.`);
        localStorage.removeItem(LAST_VIEWED_POST_URI_KEY);
      }
    } catch (error) {
      console.error('Error during scroll restoration:', error);
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

  function showThreadView(postUri) {
    threadPostUri = postUri;
    showThread = true;
  }
  function closeThread() {
    showThread = false;
    threadPostUri = '';
  }

  async function toggleLike(postUri, postCid, postIndex) {
    if (!session) return;

    const post = posts[postIndex].post;
    const isLiked = post.viewer?.like;

    try {
      if (isLiked) {
        await agent.deleteLike(post.viewer.like);
        posts[postIndex].post = {
          ...post,
          likeCount: (post.likeCount || 1) - 1,
          viewer: { ...post.viewer, like: undefined },
        };
      } else {
        const response = await agent.like(postUri, postCid);
        posts[postIndex].post = {
          ...post,
          likeCount: (post.likeCount || 0) + 1,
          viewer: { ...post.viewer, like: response.uri },
        };
      }
      posts = posts;
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
<ThreadModal open={showThread} postUri={threadPostUri} {agent} onClose={closeThread} />

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
        {#each posts as item (item.post.uri)}
          <article id={item.post.uri} class="p-4 border-b border-gray-700 flex space-x-4">
            <div>
              <img
                src={item.post.author.avatar || 'https://placehold.co/48x48/1a202c/ffffff?text=?'}
                alt={item.post.author.displayName}
                class="w-12 h-12 rounded-full bg-gray-600"
              />
            </div>
            <div class="flex-1 overflow-hidden">
              {#if item.reason && item.reason.$type === 'app.bsky.feed.defs#reasonRepost'}
                <div class="flex items-center space-x-2 text-gray-400 text-sm mb-2">
                  <span>🔁</span>
                  <span>Reposted by</span>
                  <span class="font-semibold text-gray-300">{item.reason.by.displayName || item.reason.by.handle}</span>
                </div>
              {/if}
              {#if item.post.record.reply && item.reply?.parent?.author?.did === item.post.author.did}
                <button
                  on:click={() => showThreadView(item.post.uri)}
                  class="flex items-center space-x-2 text-gray-400 text-sm mb-2 hover:text-blue-400 cursor-pointer transition-colors"
                  aria-label="View thread"
                >
                  <span>🧵</span>
                  <span>Thread</span>
                </button>
              {/if}
              <div class="flex items-center justify-between text-gray-400">
                <div class="flex items-center space-x-2">
                  <button
                    on:click={() => showUserProfile(item.post.author.handle)}
                    class="font-bold text-white truncate hover:underline cursor-pointer"
                  >
                    {item.post.author.displayName || item.post.author.handle}
                  </button>
                  <button
                    on:click={() => showUserProfile(item.post.author.handle)}
                    class="text-sm truncate hidden sm:inline hover:underline cursor-pointer"
                  >
                    @{item.post.author.handle}
                  </button>
                  <span class="text-gray-500">&middot;</span>
                  <span class="text-gray-500 text-sm flex-shrink-0">{formatPostDate(item.post.record.createdAt)}</span>
                </div>
                <button
                  on:click={() => toggleLike(item.post.uri, item.post.cid, posts.indexOf(item))}
                  class="flex items-center space-x-1 hover:text-red-400 transition-colors flex-shrink-0"
                  aria-label={item.post.viewer?.like ? 'Unlike post' : 'Like post'}
                >
                  <span class="text-lg">{item.post.viewer?.like ? '❤️' : '🤍'}</span>
                  {#if item.post.likeCount > 0}
                    <span class="text-sm">{item.post.likeCount}</span>
                  {/if}
                </button>
              </div>
              <div class="text-white mt-1 whitespace-pre-wrap break-words">
                {@html renderTextWithLinks(item.post.record.text, item.post.record.facets)}
              </div>

              {#if item.post.embed}
                <EmbedRenderer embed={item.post.embed} className="mt-3" clickableImages={true} />
              {/if}
            </div>
          </article>
        {/each}
      </main>

      {#if isFetchingMore}
        <div class="flex justify-center items-center py-8">
          <div class="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      {/if}

      {#if !timelineCursor && posts.length > 0 && !isFetchingMore}
        <p class="text-center text-gray-500 py-8">End of feed.</p>
      {/if}
    </div>
  {:else}
    <LoginForm onLoginSuccess={handleLoginSuccess} />
  {/if}
</div>

<style>
  :global(body) {
    background-color: #1a202c; /* bg-gray-900 */
    color: #e2e8f0; /* bg-gray-300 */
  }
  /* Simple scrollbar styling */
  ::-webkit-scrollbar {
    width: 8px;
  }
  ::-webkit-scrollbar-track {
    background: #1a202c; /* bg-gray-800 */
  }
  ::-webkit-scrollbar-thumb {
    background: #4a5568; /* bg-gray-600 */
    border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #718096; /* bg-gray-500 */
  }
</style>
