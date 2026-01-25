<script>
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import UserProfileModal from './UserProfileModal.svelte';
  import LoginForm from './LoginForm.svelte';
  import FeedPost from './FeedPost.svelte';
  import { toggleLike as toggleLikeUtil, processFeed } from './utils.js';
  import { auth } from './auth.svelte.js';

  // --- Svelte State Management ---
  let rawPosts = $state([]);
  let displayItems = $state([]);
  let timelineCursor = $state(null);

  // UI State
  let isFetchingMore = $state(false);
  let isRestoringScroll = $state(false);
  let isSyncing = $state(false);

  // Profile view state
  let showProfile = $state(false);
  let profileHandle = $state('');

  // --- Constants ---
  const LAST_VIEWED_POST_TIMESTAMP_KEY = 'blueskyLastViewedPostTimestamp';
  const LAST_VIEWED_POST_URI_KEY = 'blueskyLastViewedPostUri';

  // Custom AT Protocol Collection for syncing
  // We use a specific NSID (Namespace ID) to store this app's data
  const SYNC_COLLECTION = 'app.bluesky.client.lastViewed';
  const SYNC_RKEY = 'self';

  // --- Lifecycle & Initialization ---
  onMount(async () => {
    await auth.init();
    if (auth.session) {
      await fetchTimeline();
      // First try local restore (fastest)
      await restoreScrollPosition();
      // Then check remote to see if another device is ahead
      await checkRemoteScrollPosition();
    }
  });

  async function handleLoginSuccess() {
    try {
      await fetchTimeline();
      await restoreScrollPosition();
      await checkRemoteScrollPosition();
    } catch (error) {
      console.error('Error during login success handling:', error);
    }
  }

  function handleLogout() {
    auth.logout();
  }

  async function fetchTimeline() {
    if (isFetchingMore || !auth.session) return;
    isFetchingMore = true;

    try {
      const params = { limit: 30 };
      if (timelineCursor) {
        params.cursor = timelineCursor;
      }

      const response = await auth.agent.getTimeline(params);
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
        auth.logout();
      }
    } finally {
      isFetchingMore = false;
    }
  }

  // --- Scroll & Sync Handling ---
  let scrollSaveTimeout; // For local storage (fast)
  let remoteSyncTimeout; // For remote repo sync (slow/debounced)

  function handleScroll() {
    // 1. Infinite Scroll Check
    if (window.innerHeight + window.scrollY >= document.documentElement.offsetHeight - 500) {
      if (!isFetchingMore && timelineCursor) {
        fetchTimeline();
      }
    }

    // 2. Save to Local Storage (Fast, 250ms debounce)
    if (scrollSaveTimeout) clearTimeout(scrollSaveTimeout);
    scrollSaveTimeout = setTimeout(saveLocalScrollPosition, 250);

    // 3. Sync to Remote Repo (Slow, 3s debounce OR immediate if top)
    const isAtTop = window.scrollY < 50;

    if (remoteSyncTimeout) clearTimeout(remoteSyncTimeout);

    if (isAtTop) {
      // Immediate sync if user purposely scrolls to top
      syncToRepo(null); // null indicates "top"
    } else {
      // Debounce sync for 3 seconds to avoid rate limits
      remoteSyncTimeout = setTimeout(() => {
        const currentUri = getFirstVisiblePostUri();
        if (currentUri) {
          syncToRepo(currentUri);
        }
      }, 3000);
    }
  }

  function getFirstVisiblePostUri() {
    const header = document.querySelector('header');
    const headerHeight = header ? header.offsetHeight : 0;
    const firstVisiblePost = Array.from(document.querySelectorAll('main article')).find(
      (el) => el.getBoundingClientRect().bottom > headerHeight,
    );
    return firstVisiblePost ? firstVisiblePost.id : null;
  }

  function saveLocalScrollPosition() {
    const postUri = getFirstVisiblePostUri();
    if (postUri) {
      localStorage.setItem(LAST_VIEWED_POST_URI_KEY, postUri);
      const post = rawPosts.find((item) => item.post.uri === postUri);
      if (post?.post?.record?.createdAt) {
        const timestamp = new Date(post.post.record.createdAt).getTime();
        localStorage.setItem(LAST_VIEWED_POST_TIMESTAMP_KEY, timestamp.toString());
      }
    }
  }

  // Write to AT Protocol Repo
  async function syncToRepo(uri) {
    if (!auth.session || isSyncing) return;

    // Find timestamp for the URI to store alongside it
    let timestamp = Date.now();
    if (uri) {
      const post = rawPosts.find((item) => item.post.uri === uri);
      if (post?.post?.record?.createdAt) {
        timestamp = new Date(post.post.record.createdAt).getTime();
      }
    } else {
      // If uri is null (top of feed), use current time
      timestamp = Date.now();
    }

    try {
      isSyncing = true;

      // We use com.atproto.repo.putRecord to create or update a custom record
      await auth.agent.com.atproto.repo.putRecord({
        repo: auth.session.did,
        collection: SYNC_COLLECTION,
        rkey: SYNC_RKEY,
        // validate: false is CRITICAL for custom collections not in the official lexicon
        validate: false,
        record: {
          $type: SYNC_COLLECTION,
          lastViewedUri: uri,
          lastViewedAt: new Date().toISOString(),
          postTimestamp: timestamp,
          device: 'web-client',
        },
      });
      console.log('Synced position to repo:', uri || 'Top of feed');
    } catch (e) {
      console.warn('Failed to sync to repo (rate limit or permission):', e);
    } finally {
      isSyncing = false;
    }
  }

  // Fetch remote position and restore if it's newer/different
  async function checkRemoteScrollPosition() {
    try {
      const { data } = await auth.agent.com.atproto.repo.getRecord({
        repo: auth.session.did,
        collection: SYNC_COLLECTION,
        rkey: SYNC_RKEY,
      });

      if (data.value && data.value.lastViewedUri) {
        console.log('Found remote scroll position:', data.value);

        // Logic: You might want to compare timestamps here to decide
        // whether to overwrite the local position.
        // For now, we simply save it to local storage so it's picked up
        // by the standard restore logic or apply it if we are at the top.

        const remoteUri = data.value.lastViewedUri;
        const currentLocal = localStorage.getItem(LAST_VIEWED_POST_URI_KEY);

        if (remoteUri !== currentLocal) {
          // Optionally ask user or auto-jump.
          // Here we update local storage so next reload uses it,
          // or we could call restoreScrollPosition() immediately.
          localStorage.setItem(LAST_VIEWED_POST_URI_KEY, remoteUri);
          if (data.value.postTimestamp) {
            localStorage.setItem(LAST_VIEWED_POST_TIMESTAMP_KEY, data.value.postTimestamp.toString());
          }

          // If we are currently at the top, jump to the remote position automatically
          if (window.scrollY < 100) {
            await restoreScrollPosition();
          }
        }
      }
    } catch (e) {
      // It's normal to fail if the record doesn't exist yet
      if (e.status !== 404) console.warn('Could not fetch remote scroll position:', e);
    }
  }

  // --- Existing Restore Logic (Simplified) ---
  async function restoreScrollPosition() {
    const savedUri = localStorage.getItem(LAST_VIEWED_POST_URI_KEY);

    // 1. Try URI Match
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
            await fetchTimeline();
            attempts++;
          }
        }

        if (elementToRestore) {
          scrollToElement(elementToRestore);
          isRestoringScroll = false;
          return;
        }
      } catch (error) {
        console.error('Error during URI-based scroll restoration:', error);
      }
    }

    // 2. Fallback to Timestamp Match (existing logic...)
    // ... [Include your existing timestamp logic here if desired] ...

    isRestoringScroll = false;
  }

  function scrollToElement(element) {
    const header = document.querySelector('header');
    const headerHeight = header ? header.offsetHeight : 0;
    element.scrollIntoView({ behavior: 'auto', block: 'start' });
    if (headerHeight > 0) {
      window.scrollBy(0, -headerHeight - 16);
    }
  }

  function showUserProfile(userHandle) {
    profileHandle = userHandle;
    showProfile = true;
  }
  function closeProfile() {
    showProfile = false;
    profileHandle = '';
  }

  async function toggleLike({ item }) {
    if (!auth.session) return;
    const post = item.post;

    const updatePostInList = (list, targetUri, changes) => {
      return list.map((entry) => {
        if (entry.post.uri === targetUri) {
          return { ...entry, post: { ...entry.post, ...changes } };
        }
        return entry;
      });
    };

    const updatePostInDisplayItems = (items, targetUri, changes) => {
      return items.map((entry) => {
        if (entry.type === 'post') {
          if (entry.item.post.uri === targetUri) {
            return {
              ...entry,
              item: {
                ...entry.item,
                post: { ...entry.item.post, ...changes },
              },
            };
          }
        } else if (entry.type === 'threadGroup') {
          const index = entry.items.findIndex((p) => p.post.uri === targetUri);
          if (index !== -1) {
            const newItems = [...entry.items];
            newItems[index] = {
              ...newItems[index],
              post: { ...newItems[index].post, ...changes },
            };
            return { ...entry, items: newItems };
          }
        }
        return entry;
      });
    };

    try {
      await toggleLikeUtil(auth.agent, post, (uri, changes) => {
        rawPosts = updatePostInList(rawPosts, uri, changes);
        displayItems = updatePostInDisplayItems(displayItems, uri, changes);
      });
    } catch (error) {
      // Error is logged in utility
    }
  }

  function openThread(post) {
    const encodedUri = encodeURIComponent(post.post.uri);
    goto(`/thread/${encodedUri}`);
  }
</script>

<svelte:window onscroll={handleScroll} />

{#if isRestoringScroll}
  <div class="fixed bottom-4 right-4 bg-gray-700 text-white py-2 px-4 rounded-lg shadow-lg z-20 flex items-center space-x-2">
    <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
    <span>Restoring position...</span>
  </div>
{/if}

{#if isSyncing}
  <div class="fixed bottom-4 left-4 text-xs text-gray-500 z-20">Saving position...</div>
{/if}

<UserProfileModal open={showProfile} handle={profileHandle} agent={auth.agent} session={auth.session} onClose={closeProfile} />

<div class="max-w-2xl mx-auto font-sans">
  {#if auth.isLoading && !auth.session}
    <div class="min-h-screen flex items-center justify-center">
      <div class="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
    </div>
  {:else if auth.session}
    <div>
      <header class="sticky top-0 bg-gray-900 bg-opacity-80 backdrop-blur-md z-20 border-b border-gray-700">
        <div class="flex justify-between items-center p-4">
          <h1 class="text-xl font-bold text-blue-400">{auth.session.handle ? `${auth.session.handle}'s feed` : 'Your Feed'}</h1>
          <button
            onclick={handleLogout}
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
                connectDown={true}
                onlike={toggleLike}
                onprofile={(e) => showUserProfile(e.handle)}
              />

              {#if entry.items.length > 1}
                <button
                  onclick={() => openThread(entry.items[0])}
                  class="w-full text-left block pl-16 py-2 hover:bg-gray-800 cursor-pointer flex items-center text-blue-400 text-sm font-semibold transition-colors relative"
                >
                  <div class="w-0.5 h-full bg-gray-600 absolute left-[39px] top-0 bottom-0"></div>
                  <span class="ml-2">Show full thread ({entry.items.length + 1} posts)</span>
                </button>
              {/if}

              <FeedPost item={entry.items[0]} connectUp={true} onlike={toggleLike} onprofile={(e) => showUserProfile(e.handle)} />
            </div>
          {:else}
            <FeedPost item={entry.item} onlike={toggleLike} onprofile={(e) => showUserProfile(e.handle)} />
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
