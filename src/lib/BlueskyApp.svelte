<script>
  import { onMount } from 'svelte';

  // Import the official Bluesky SDK
  import { AtpAgent } from '@atproto/api';

  // --- Svelte State Management ---
  let agent = null;
  let session = null; // Storing the session object will determine if the user is logged in
  let posts = [];
  let timelineCursor = null;

  // UI State
  let isLoading = true; // Start as true to show loader while checking session
  let isFetchingMore = false; // For infinite scroll loading
  let loginError = '';

  // Form input bindings
  let handle = '';
  let password = '';

  // --- Constants ---
  const BLUESKY_SERVICE = 'https://bsky.social';
  const SCROLL_POSITION_KEY = 'blueskyScrollPosition';
  const SESSION_KEY = 'blueskySession';

  // --- Lifecycle & Initialization ---

  // onMount is Svelte's equivalent of running code when the component first loads
  onMount(async () => {
    const savedSession = localStorage.getItem(SESSION_KEY);

    if (savedSession) {
      agent = new AtpAgent({ service: BLUESKY_SERVICE });
      try {
        const sessionData = JSON.parse(savedSession);
        await agent.resumeSession(sessionData);
        session = agent.session; // This assignment triggers the UI to switch to the feed view
        console.log('Session resumed successfully.');
        await fetchTimeline(true); // Initial fetch, restore scroll
      } catch (error) {
        console.error('Failed to resume session:', error);
        localStorage.removeItem(SESSION_KEY);
        session = null; // Ensure we are logged out
      }
    }
    isLoading = false;
  });

  // --- Core Functions ---

  async function handleLogin() {
    isLoading = true;
    loginError = '';

    try {
      agent = new BskyAgent({ service: BLUESKY_SERVICE });
      const response = await agent.login({ identifier: handle, password });

      if (response.success) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(agent.session));
        session = agent.session;
        await fetchTimeline();
      } else {
        throw new Error('Login failed. Please check your handle and password.');
      }
    } catch (error) {
      console.error('Login error:', error);
      loginError = error.message || 'An unknown error occurred.';
    } finally {
      isLoading = false;
    }
  }

  function handleLogout() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SCROLL_POSITION_KEY);
    session = null;
    posts = [];
    timelineCursor = null;
    // Reloading the page ensures a clean state
    window.location.reload();
  }

  async function fetchTimeline(shouldRestoreScroll = false) {
    if (isFetchingMore || !session) return;
    isFetchingMore = true;

    try {
      // Build params without including a null/undefined cursor. The API treats literal 'cursor=null' poorly.
      const params = { limit: 30 };
      if (timelineCursor) params.cursor = timelineCursor; // only include when we actually have one

      const response = await agent.getTimeline(params);

      // Debug logging (can be removed later)
      if (!response?.success) {
        console.warn('getTimeline response not successful:', response);
      }

      if (response.data.feed.length > 0) {
        const newPosts = response.data.feed.filter((item) => item.post); // Filter for valid posts
        posts = [...posts, ...newPosts]; // Append new posts to the existing array
        timelineCursor = response.data.cursor;
      } else {
        // No more posts to load
        timelineCursor = null; // Stop further requests
      }

      if (shouldRestoreScroll) {
        restoreScrollPosition();
      }
    } catch (error) {
      const status = error?.response?.status || error?.status; // Some fetch libs attach status
      console.error('Failed to fetch timeline:', { error, status, timelineCursor });
      if (status === 502 || status === 503 || status === 504) {
        loginError = 'Feed temporarily unavailable (server error). Retrying may work.';
      } else if (status === 401) {
        loginError = 'Session expired. Please log in again.';
      } else {
        loginError = 'Could not load feed.';
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
      localStorage.setItem(SCROLL_POSITION_KEY, window.scrollY);
    }, 250);
  }

  function restoreScrollPosition() {
    const savedPosition = localStorage.getItem(SCROLL_POSITION_KEY);
    if (savedPosition) {
      requestAnimationFrame(() => {
        window.scrollTo(0, parseInt(savedPosition, 10));
      });
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

  // Simple function to sanitize text for display
  const escapeHtml = (unsafe) => {
    if (!unsafe) return '';
    return unsafe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  };
</script>

<!-- svelte:window binds events to the global window object -->
<svelte:window on:scroll={handleInfiniteScroll} />

<div class="max-w-2xl mx-auto font-sans">
  {#if isLoading && !session}
    <!-- Initial Loading State -->
    <div class="min-h-screen flex items-center justify-center">
      <div class="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
    </div>
  {:else if session}
    <!-- Feed View -->
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
          <article class="p-4 border-b border-gray-700 flex space-x-4">
            <div>
              <img
                src={item.post.author.avatar || 'https://placehold.co/48x48/1a202c/ffffff?text=?'}
                alt={item.post.author.displayName}
                class="w-12 h-12 rounded-full bg-gray-600"
              />
            </div>
            <div class="flex-1 overflow-hidden">
              <div class="flex items-center space-x-2 text-gray-400">
                <span class="font-bold text-white truncate">{item.post.author.displayName || item.post.author.handle}</span>
                <span class="text-sm truncate hidden sm:inline">@{item.post.author.handle}</span>
                <span class="text-gray-500">&middot;</span>
                <span class="text-gray-500 text-sm flex-shrink-0">{new Date(item.post.record.createdAt).toLocaleString()}</span>
              </div>
              <div class="text-white mt-1 whitespace-pre-wrap break-words">
                {@html escapeHtml(item.post.record.text || '').replace(/\n/g, '<br>')}
              </div>

              <!-- Embedded Content: Images or Quoted Post -->
              {#if item.post.embed}
                <!-- Images -->
                {#if item.post.embed.images}
                  <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {#each item.post.embed.images as img}
                      <a href={img.fullsize} target="_blank" rel="noopener noreferrer">
                        <img
                          src={img.thumb}
                          alt={img.alt || 'Embedded image'}
                          class="rounded-lg w-full h-auto object-cover border border-gray-600"
                        />
                      </a>
                    {/each}
                  </div>
                {/if}

                <!-- Quoted Post -->
                {#if item.post.embed.$type === 'app.bsky.embed.record#view' && item.post.embed.record && !item.post.embed.record.notFound}
                  {@const quotedPost = item.post.embed.record}
                  <div class="mt-3 border border-gray-600 rounded-lg p-3">
                    <div class="flex items-center space-x-2 text-sm text-gray-400">
                      <img
                        src={quotedPost.author.avatar || 'https://placehold.co/24x24/1a202c/ffffff?text=?'}
                        class="w-6 h-6 rounded-full bg-gray-600"
                        alt={quotedPost.author.displayName}
                      />
                      <span class="font-bold text-white">{quotedPost.author.displayName || quotedPost.author.handle}</span>
                      <span class="truncate">@{quotedPost.author.handle}</span>
                    </div>
                    <div class="text-white mt-2 text-sm whitespace-pre-wrap break-words">
                      {@html escapeHtml(quotedPost.value.text || '').replace(/\n/g, '<br>')}
                    </div>
                  </div>
                {/if}
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
    <!-- Login View -->
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="w-full max-w-sm bg-gray-800 rounded-lg shadow-lg p-8">
        <h1 class="text-3xl font-bold text-center mb-2 text-blue-400">Bluesky Client</h1>
        <p class="text-center text-gray-400 mb-6">Log in to view your feed.</p>
        <form on:submit|preventDefault={handleLogin}>
          <div class="mb-4">
            <label for="handle" class="block text-gray-300 text-sm font-bold mb-2">Bluesky Handle</label>
            <!-- bind:value creates a two-way binding between the input and the variable -->
            <input
              type="text"
              id="handle"
              bind:value={handle}
              class="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="example.bsky.social"
              required
            />
          </div>
          <div class="mb-6">
            <label for="password" class="block text-gray-300 text-sm font-bold mb-2">App Password</label>
            <input
              type="password"
              id="password"
              bind:value={password}
              class="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="xxxx-xxxx-xxxx-xxxx"
              required
            />
            <p class="text-xs text-gray-500 mt-2">
              Use an <a
                href="https://bsky.app/settings/app-passwords"
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-400 hover:underline">App Password</a
              > for security.
            </p>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:shadow-outline transition duration-150 ease-in-out disabled:bg-blue-800 disabled:cursor-not-allowed"
          >
            {#if isLoading}
              Logging in...
            {:else}
              Login
            {/if}
          </button>
          {#if loginError}
            <p class="text-red-400 text-sm mt-4 text-center">{loginError}</p>
          {/if}
        </form>
      </div>
    </div>
  {/if}
</div>

<!-- Global styles can be placed in a separate app.css or directly here -->
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
