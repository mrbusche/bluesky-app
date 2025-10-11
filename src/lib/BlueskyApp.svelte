<script>
  import { onMount, tick } from 'svelte';

  // Import the official Bluesky SDK
  import { AtpAgent } from '@atproto/api';

  // --- Svelte State Management ---
  let agent = null;
  let session = null;
  let posts = [];
  let timelineCursor = null;

  // UI State
  let isLoading = true;
  let isFetchingMore = false;
  let loginError = '';
  let isRestoringScroll = false;

  // Form input bindings
  let handle = '';
  let password = '';
  let followHandle = '';
  let followMessage = '';
  let isFollowing = false;

  // Profile view state
  let showProfile = false;
  let profileData = null;
  let isLoadingProfile = false;
  let profileError = '';

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

  async function handleLogin() {
    isLoading = true;
    loginError = '';

    try {
      agent = new AtpAgent({ service: BLUESKY_SERVICE });
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
        const newPosts = response.data.feed.filter((item) => item.post && !item.post.record.reply);
        posts = [...posts, ...newPosts];
        timelineCursor = response.data.cursor;
      } else {
        timelineCursor = null;
      }
    } catch (error) {
      const status = error?.response?.status || error?.status;
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
      const header = document.querySelector('header');
      const headerHeight = header ? header.offsetHeight : 0;

      // Find the first post whose bottom edge is below the sticky header
      const firstVisiblePost = Array.from(document.querySelectorAll('main > article')).find(
        (el) => el.getBoundingClientRect().bottom > headerHeight,
      );

      if (firstVisiblePost) {
        localStorage.setItem(LAST_VIEWED_POST_URI_KEY, firstVisiblePost.id);
      }
    }, 250); // Debounce to avoid excessive writes
  }

  async function restoreScrollPosition() {
    const savedUri = localStorage.getItem(LAST_VIEWED_POST_URI_KEY);
    if (!savedUri) return;

    isRestoringScroll = true;
    try {
      let elementToRestore = null;
      let attempts = 0;
      const MAX_FETCH_ATTEMPTS = 10; // Safety break to prevent infinite loops

      // Loop while the element isn't found, we still have a cursor to fetch more,
      // and we haven't hit our safety limit.
      while (!elementToRestore && timelineCursor && attempts < MAX_FETCH_ATTEMPTS) {
        await tick(); // Wait for any pending DOM updates from the last fetch
        elementToRestore = document.getElementById(savedUri);

        // If not found after checking the DOM, fetch the next page of posts
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
        localStorage.removeItem(LAST_VIEWED_POST_URI_KEY); // Clean up invalid URI
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
    // This now saves the current post URI on scroll
    saveScrollPosition();
  }

  const escapeHtml = (unsafe) => {
    if (!unsafe) return '';
    return unsafe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  };

  const formatPostDate = (dateString) => {
    const postDate = new Date(dateString);
    const now = new Date();
    const diffInMs = now - postDate;
    const diffInMinutes = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMs / 3600000);
    const diffInDays = Math.floor(diffInMs / 86400000);

    if (diffInMinutes < 60) {
      return `${diffInMinutes}m`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h`;
    } else if (diffInDays <= 31) {
      return `${diffInDays}d`;
    } else {
      const month = postDate.getMonth() + 1;
      const day = postDate.getDate();
      const year = postDate.getFullYear();
      return `${month}/${day}/${year}`;
    }
  };

  async function handleFollow() {
    if (!followHandle.trim() || !session) return;
    
    isFollowing = true;
    followMessage = '';

    try {
      // Resolve the handle to a DID
      const resolvedHandle = followHandle.trim();
      const response = await agent.resolveHandle({ handle: resolvedHandle });
      
      if (response.data && response.data.did) {
        // Follow the user
        await agent.follow(response.data.did);
        followMessage = `Successfully followed @${resolvedHandle}!`;
        followHandle = '';
        
        // Clear the success message after 3 seconds
        setTimeout(() => {
          followMessage = '';
        }, 3000);
      } else {
        throw new Error('Could not resolve handle');
      }
    } catch (error) {
      console.error('Follow error:', error);
      followMessage = error.message || 'Failed to follow user. Please check the handle and try again.';
    } finally {
      isFollowing = false;
    }
  }

  async function showUserProfile(userHandle) {
    showProfile = true;
    isLoadingProfile = true;
    profileError = '';
    profileData = null;

    try {
      const response = await agent.getProfile({ actor: userHandle });
      profileData = response.data;
    } catch (error) {
      console.error('Profile fetch error:', error);
      profileError = error.message || 'Failed to load profile.';
    } finally {
      isLoadingProfile = false;
    }
  }

  function closeProfile() {
    showProfile = false;
    profileData = null;
    profileError = '';
  }

  async function followFromProfile() {
    if (!profileData || !session) return;
    
    isFollowing = true;

    try {
      await agent.follow(profileData.did);
      // Update the profile data to reflect the follow
      if (profileData) {
        profileData.viewer = { ...profileData.viewer, following: true };
      }
    } catch (error) {
      console.error('Follow error:', error);
      profileError = error.message || 'Failed to follow user.';
    } finally {
      isFollowing = false;
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

{#if showProfile}
  <div class="fixed inset-0 bg-black bg-opacity-75 z-30 flex items-center justify-center p-4" on:click={closeProfile}>
    <div class="bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6" on:click|stopPropagation>
      <div class="flex justify-between items-start mb-4">
        <h2 class="text-xl font-bold text-blue-400">Profile</h2>
        <button on:click={closeProfile} class="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
      </div>

      {#if isLoadingProfile}
        <div class="flex justify-center items-center py-8">
          <div class="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      {:else if profileError}
        <p class="text-red-400 text-center py-4">{profileError}</p>
      {:else if profileData}
        <div class="space-y-4">
          <div class="flex items-center space-x-4">
            <img
              src={profileData.avatar || 'https://placehold.co/64x64/1a202c/ffffff?text=?'}
              alt={profileData.displayName}
              class="w-16 h-16 rounded-full bg-gray-600"
            />
            <div class="flex-1">
              <h3 class="font-bold text-white text-lg">{profileData.displayName || profileData.handle}</h3>
              <p class="text-gray-400 text-sm">@{profileData.handle}</p>
            </div>
          </div>

          {#if profileData.description}
            <p class="text-white whitespace-pre-wrap break-words">{profileData.description}</p>
          {/if}

          <div class="flex space-x-4 text-sm text-gray-400">
            <span><strong class="text-white">{profileData.followersCount || 0}</strong> followers</span>
            <span><strong class="text-white">{profileData.followsCount || 0}</strong> following</span>
            <span><strong class="text-white">{profileData.postsCount || 0}</strong> posts</span>
          </div>

          {#if !profileData.viewer?.following}
            <button
              on:click={followFromProfile}
              disabled={isFollowing}
              class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-150 ease-in-out disabled:bg-blue-800 disabled:cursor-not-allowed"
            >
              {#if isFollowing}
                Following...
              {:else}
                Follow
              {/if}
            </button>
          {:else}
            <div class="w-full bg-green-600 text-white font-bold py-2 px-4 rounded-md text-center">
              Following
            </div>
          {/if}

          {#if profileError}
            <p class="text-red-400 text-sm text-center">{profileError}</p>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

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
        <div class="px-4 pb-4">
          <form on:submit|preventDefault={handleFollow} class="flex gap-2">
            <input
              type="text"
              bind:value={followHandle}
              placeholder="Enter handle to follow (e.g., user.bsky.social)"
              class="flex-1 bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isFollowing}
            />
            <button
              type="submit"
              disabled={isFollowing || !followHandle.trim()}
              class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md text-sm transition duration-150 ease-in-out disabled:bg-blue-800 disabled:cursor-not-allowed"
            >
              {#if isFollowing}
                Following...
              {:else}
                Follow
              {/if}
            </button>
          </form>
          {#if followMessage}
            <p class="text-sm mt-2 text-center" class:text-green-400={followMessage.includes('Successfully')} class:text-red-400={!followMessage.includes('Successfully')}>
              {followMessage}
            </p>
          {/if}
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
              <div class="flex items-center space-x-2 text-gray-400">
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
              <div class="text-white mt-1 whitespace-pre-wrap break-words">
                {@html escapeHtml(item.post.record.text || '').replace(/\n/g, '<br>')}
              </div>

              {#if item.post.embed}
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
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="w-full max-w-sm bg-gray-800 rounded-lg shadow-lg p-8">
        <h1 class="text-3xl font-bold text-center mb-2 text-blue-400">Bluesky Client</h1>
        <p class="text-center text-gray-400 mb-6">Log in to view your feed.</p>
        <form on:submit|preventDefault={handleLogin}>
          <div class="mb-4">
            <label for="handle" class="block text-gray-300 text-sm font-bold mb-2">Bluesky Handle</label>
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
