<script>
  import { onMount, tick } from 'svelte';
  import EmbedRenderer from './EmbedRenderer.svelte';
  import UserProfileModal from './UserProfileModal.svelte';
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
    localStorage.removeItem(LAST_VIEWED_POST_TIMESTAMP_KEY);
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
        posts = [...posts, ...newPosts];
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
        const postUri = firstVisiblePost.id;
        // Save both URI (primary) and timestamp (fallback)
        localStorage.setItem(LAST_VIEWED_POST_URI_KEY, postUri);
        const post = posts.find((item) => item.post.uri === postUri);
        if (post?.post?.record?.createdAt) {
          const timestamp = new Date(post.post.record.createdAt).getTime();
          localStorage.setItem(LAST_VIEWED_POST_TIMESTAMP_KEY, timestamp.toString());
        }
      }
    }, 250);
  }

  async function restoreScrollPosition() {
    // Try URI-based approach first (original implementation)
    const savedUri = localStorage.getItem(LAST_VIEWED_POST_URI_KEY);
    
    if (savedUri) {
      isRestoringScroll = true;
      try {
        let elementToRestore = null;
        let attempts = 0;
        const MAX_FETCH_ATTEMPTS = 10;

        // Try to find the post by URI, fetching more posts if needed
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
          isRestoringScroll = false;
          return; // Successfully restored using URI
        } else {
          console.warn(`Could not find post ${savedUri} after ${attempts} fetches. Trying timestamp fallback.`);
        }
      } catch (error) {
        console.error('Error during URI-based scroll restoration:', error);
      }
    }

    // Fallback to timestamp-based approach if URI didn't work
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

      // Function to find the closest post by timestamp
      const findClosestPost = () => {
        let closest = null;
        let minDiff = Infinity;
        
        for (const item of posts) {
          if (item.post?.record?.createdAt) {
            const postTimestamp = new Date(item.post.record.createdAt).getTime();
            const diff = Math.abs(postTimestamp - targetTimestamp);
            
            if (diff < minDiff) {
              minDiff = diff;
              closest = item;
            }
            
            // If we found a post with the exact timestamp, we can stop
            if (diff === 0) break;
          }
        }
        
        return closest;
      };

      // Try to find the closest post, fetching more posts if needed
      while (attempts < MAX_FETCH_ATTEMPTS) {
        await tick();
        closestPost = findClosestPost();
        
        if (closestPost) {
          const closestTimestamp = new Date(closestPost.post.record.createdAt).getTime();
          
          // If we found an exact match or a very close match, use it
          if (closestTimestamp === targetTimestamp) {
            break;
          }
          
          // If we found a post that's newer than the target and we have more to fetch, keep trying
          if (closestTimestamp > targetTimestamp && timelineCursor) {
            console.log(`Closest post is newer than target, fetching more...`);
            await fetchTimeline();
            attempts++;
          } else {
            // We found the best match we can
            break;
          }
        } else if (timelineCursor) {
          console.log(`No posts found yet, fetching more...`);
          await fetchTimeline();
          attempts++;
        } else {
          break;
        }
      }

      if (closestPost) {
        const postTimestamp = new Date(closestPost.post.record.createdAt).getTime();
        const diffSeconds = Math.abs(postTimestamp - targetTimestamp) / 1000;
        console.log(`Found closest post (${diffSeconds.toFixed(0)}s difference) after ${attempts} fetches using timestamp fallback. Scrolling into view.`);
        
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
        console.warn(`Could not find a suitable post after ${attempts} fetches. Clearing saved position.`);
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
                <div class="flex items-center space-x-2 text-gray-400 text-sm mb-2">
                  <span>🧵</span>
                  <span>Thread</span>
                </div>
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
              <div class="text-white mt-1 whitespace-pre-wrap break-words" on:click={(e) => {
                const target = e.target;
                if (target.dataset.mentionDid) {
                  const mentionText = target.textContent;
                  // Extract handle from mention text (remove @ prefix if present)
                  const handle = mentionText.startsWith('@') ? mentionText.slice(1) : mentionText;
                  showUserProfile(handle);
                }
              }} on:keydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  const target = e.target;
                  if (target.dataset.mentionDid) {
                    const mentionText = target.textContent;
                    const handle = mentionText.startsWith('@') ? mentionText.slice(1) : mentionText;
                    showUserProfile(handle);
                    e.preventDefault();
                  }
                }
              }}>
                {@html renderTextWithLinks(item.post.record.text, item.post.record.facets)}
              </div>

              {#if item.post.embed}
                <EmbedRenderer embed={item.post.embed} className="mt-3" clickableImages={true} showUserProfile={showUserProfile} />
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
