<script>
  import { onMount, tick } from 'svelte';
  import VideoPlayer from './VideoPlayer.svelte';
  import Link from './Link.svelte';
  import ImageLink from './ImageLink.svelte';
  import UserProfileModal from './UserProfileModal.svelte';
  import LoginForm from './LoginForm.svelte';

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
  let isRestoringScroll = false;

  // Profile view state
  let showProfile = false;
  let profileHandle = '';

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

  async function handleLoginSuccess(event) {
    const { agent: newAgent, session: newSession } = event.detail;
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
          // If there's no reply field, it's a top-level post - include it
          if (!item.post.record.reply) return true;
          // If there is a reply field, only include it if it's a self-reply (threaded post)
          // by checking if the post author matches the reply parent author
          const parentAuthorDid = item.reply?.parent?.author?.did;
          if (parentAuthorDid !== null && parentAuthorDid !== undefined) {
            return item.post.author.did === parentAuthorDid;
          }
          // If we can't determine, exclude it to avoid clutter
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
        // Handle session expiration by clearing session and reloading
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

  const renderTextWithLinks = (text, facets) => {
    if (!text) return '';
    if (!facets || facets.length === 0) {
      return escapeHtml(text).replace(/\n/g, '<br>');
    }

    // Convert text to UTF-8 bytes for proper indexing
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const bytes = encoder.encode(text);

    // Sort facets by index to process them in order
    const sortedFacets = [...facets].sort((a, b) => a.index.byteStart - b.index.byteStart);

    let result = '';
    let lastIndex = 0;

    for (const facet of sortedFacets) {
      const { byteStart, byteEnd } = facet.index;

      // Add text before this facet
      if (byteStart > lastIndex) {
        const beforeBytes = bytes.slice(lastIndex, byteStart);
        const beforeText = decoder.decode(beforeBytes);
        result += escapeHtml(beforeText);
      }

      // Extract the facet text
      const facetBytes = bytes.slice(byteStart, byteEnd);
      const facetText = decoder.decode(facetBytes);

      // Check if this facet is a link
      const linkFeature = facet.features?.find((f) => f.$type === 'app.bsky.richtext.facet#link');
      if (linkFeature && linkFeature.uri) {
        // Note: We output HTML here; for consistency with Link component styling, keep classes.
        result += `<a href="${escapeHtml(linkFeature.uri)}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">${escapeHtml(facetText)}</a>`;
      } else {
        // For mentions and other facets, just render as text for now
        result += escapeHtml(facetText);
      }

      lastIndex = byteEnd;
    }

    // Add remaining text after last facet
    if (lastIndex < bytes.length) {
      const afterBytes = bytes.slice(lastIndex);
      const afterText = decoder.decode(afterBytes);
      result += escapeHtml(afterText);
    }

    return result.replace(/\n/g, '<br>');
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
        // Unlike the post
        await agent.deleteLike(post.viewer.like);
        // Update the post to reflect the unlike
        posts[postIndex].post = {
          ...post,
          likeCount: (post.likeCount || 1) - 1,
          viewer: { ...post.viewer, like: undefined },
        };
      } else {
        // Like the post
        const response = await agent.like(postUri, postCid);
        // Update the post to reflect the like
        posts[postIndex].post = {
          ...post,
          likeCount: (post.likeCount || 0) + 1,
          viewer: { ...post.viewer, like: response.uri },
        };
      }
      // Trigger reactivity
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

<UserProfileModal open={showProfile} handle={profileHandle} {agent} {session} on:close={closeProfile} />

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
              <div class="text-white mt-1 whitespace-pre-wrap break-words">
                {@html renderTextWithLinks(item.post.record.text, item.post.record.facets)}
              </div>

              {#if item.post.embed}
                {#if item.post.embed.images}
                  <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {#each item.post.embed.images as img}
                      <ImageLink href={img.fullsize}>
                        <img
                          src={img.thumb}
                          alt={img.alt || 'Embedded image'}
                          class="rounded-lg w-full h-auto object-cover border border-gray-600"
                        />
                      </ImageLink>
                    {/each}
                  </div>
                {/if}

                {#if item.post.embed.$type === 'app.bsky.embed.video#view' && item.post.embed.playlist}
                  <div class="mt-3">
                    <VideoPlayer playlist={item.post.embed.playlist} poster={item.post.embed.thumbnail} />
                  </div>
                {/if}

                {#if item.post.embed.$type === 'app.bsky.embed.external#view' && item.post.embed.external}
                  <Link
                    href={item.post.embed.external.uri}
                    class="mt-3 block border border-gray-600 rounded-lg overflow-hidden hover:border-gray-500 transition-colors"
                  >
                    {#if item.post.embed.external.thumb}
                      <img
                        src={item.post.embed.external.thumb}
                        alt={item.post.embed.external.title}
                        class="w-full h-48 object-cover bg-gray-700"
                      />
                    {/if}
                    <div class="p-3 bg-gray-800">
                      <div class="text-white font-semibold text-sm line-clamp-1">{item.post.embed.external.title}</div>
                      {#if item.post.embed.external.description}
                        <div class="text-gray-400 text-xs mt-1 line-clamp-2">{item.post.embed.external.description}</div>
                      {/if}
                      <div class="text-gray-500 text-xs mt-1 truncate">{item.post.embed.external.uri}</div>
                    </div>
                  </Link>
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
                      {@html renderTextWithLinks(quotedPost.value.text, quotedPost.value.facets)}
                    </div>

                    {#if quotedPost.embeds && quotedPost.embeds.length > 0}
                      {#each quotedPost.embeds as embed}
                        {#if embed.$type === 'app.bsky.embed.video#view' && embed.playlist}
                          <div class="mt-2">
                            <VideoPlayer playlist={embed.playlist} poster={embed.thumbnail} />
                          </div>
                        {/if}
                        {#if embed.images}
                          <div class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {#each embed.images as img}
                              <img
                                src={img.thumb}
                                alt={img.alt || 'Embedded image'}
                                class="rounded-lg w-full h-auto object-cover border border-gray-600"
                              />
                            {/each}
                          </div>
                        {/if}
                        {#if embed.$type === 'app.bsky.embed.external#view' && embed.external}
                          <Link
                            href={embed.external.uri}
                            class="mt-2 block border border-gray-600 rounded-lg overflow-hidden hover:border-gray-500 transition-colors"
                          >
                            {#if embed.external.thumb}
                              <img src={embed.external.thumb} alt={embed.external.title} class="w-full h-48 object-cover bg-gray-700" />
                            {/if}
                            <div class="p-3 bg-gray-800">
                              <div class="text-white font-semibold text-sm line-clamp-1">{embed.external.title}</div>
                              {#if embed.external.description}
                                <div class="text-gray-400 text-xs mt-1 line-clamp-2">{embed.external.description}</div>
                              {/if}
                              <div class="text-gray-500 text-xs mt-1 truncate">{embed.external.uri}</div>
                            </div>
                          </Link>
                        {/if}
                      {/each}
                    {/if}
                  </div>
                {/if}

                {#if item.post.embed.$type === 'app.bsky.embed.recordWithMedia#view'}
                  {#if item.post.embed.media?.$type === 'app.bsky.embed.external#view' && item.post.embed.media.external}
                    <Link
                      href={item.post.embed.media.external.uri}
                      class="mt-3 block border border-gray-600 rounded-lg overflow-hidden hover:border-gray-500 transition-colors"
                    >
                      {#if item.post.embed.media.external.thumb}
                        <img
                          src={item.post.embed.media.external.thumb}
                          alt={item.post.embed.media.external.title}
                          class="w-full h-48 object-cover bg-gray-700"
                        />
                      {/if}
                      <div class="p-3 bg-gray-800">
                        <div class="text-white font-semibold text-sm line-clamp-1">{item.post.embed.media.external.title}</div>
                        {#if item.post.embed.media.external.description}
                          <div class="text-gray-400 text-xs mt-1 line-clamp-2">{item.post.embed.media.external.description}</div>
                        {/if}
                        <div class="text-gray-500 text-xs mt-1 truncate">{item.post.embed.media.external.uri}</div>
                      </div>
                    </Link>
                  {/if}

                  {#if item.post.embed.media?.images}
                    <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {#each item.post.embed.media.images as img}
                        <ImageLink href={img.fullsize}>
                          <img
                            src={img.thumb}
                            alt={img.alt || 'Embedded image'}
                            class="rounded-lg w-full h-auto object-cover border border-gray-600"
                          />
                        </ImageLink>
                      {/each}
                    </div>
                  {/if}

                  {#if item.post.embed.media?.$type === 'app.bsky.embed.video#view' && item.post.embed.media.playlist}
                    <div class="mt-3">
                      <VideoPlayer playlist={item.post.embed.media.playlist} poster={item.post.embed.media.thumbnail} />
                    </div>
                  {/if}

                  {#if item.post.embed.record?.record && !item.post.embed.record.record.notFound}
                    {@const quotedPost = item.post.embed.record.record}
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
                        {@html renderTextWithLinks(quotedPost.value.text, quotedPost.value.facets)}
                      </div>

                      {#if quotedPost.embeds && quotedPost.embeds.length > 0}
                        {#each quotedPost.embeds as embed}
                          {#if embed.$type === 'app.bsky.embed.video#view' && embed.playlist}
                            <div class="mt-2">
                              <VideoPlayer playlist={embed.playlist} poster={embed.thumbnail} />
                            </div>
                          {/if}
                          {#if embed.images}
                            <div class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {#each embed.images as img}
                                <img
                                  src={img.thumb}
                                  alt={img.alt || 'Embedded image'}
                                  class="rounded-lg w-full h-auto object-cover border border-gray-600"
                                />
                              {/each}
                            </div>
                          {/if}
                          {#if embed.$type === 'app.bsky.embed.external#view' && embed.external}
                            <Link
                              href={embed.external.uri}
                              class="mt-2 block border border-gray-600 rounded-lg overflow-hidden hover:border-gray-500 transition-colors"
                            >
                              {#if embed.external.thumb}
                                <img src={embed.external.thumb} alt={embed.external.title} class="w-full h-48 object-cover bg-gray-700" />
                              {/if}
                              <div class="p-3 bg-gray-800">
                                <div class="text-white font-semibold text-sm line-clamp-1">{embed.external.title}</div>
                                {#if embed.external.description}
                                  <div class="text-gray-400 text-xs mt-1 line-clamp-2">{embed.external.description}</div>
                                {/if}
                                <div class="text-gray-500 text-xs mt-1 truncate">{embed.external.uri}</div>
                              </div>
                            </Link>
                          {/if}
                        {/each}
                      {/if}
                    </div>
                  {/if}
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
    <LoginForm on:loginSuccess={handleLoginSuccess} />
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
