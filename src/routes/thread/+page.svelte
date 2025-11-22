<script>
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { AtpAgent } from '@atproto/api';
  import EmbedRenderer from '$lib/EmbedRenderer.svelte';
  import { renderTextWithLinks, formatPostDate } from '$lib/utils.js';

  let agent = null;
  let session = null;
  let isLoading = false;
  let error = '';
  let threadPosts = [];
  let threadUri = '';

  const BLUESKY_SERVICE = 'https://bsky.social';
  const SESSION_KEY = 'bluesky-session';

  onMount(async () => {
    // Get the URI from URL params
    const params = new URLSearchParams(window.location.search);
    threadUri = params.get('uri') || '';
    
    if (!threadUri) {
      error = 'No thread URI provided';
      return;
    }

    // Get session and agent
    const sessionData = localStorage.getItem(SESSION_KEY);
    if (sessionData) {
      try {
        const parsedSession = JSON.parse(sessionData);
        agent = new AtpAgent({ service: BLUESKY_SERVICE });
        await agent.resumeSession(parsedSession);
        session = agent.session;
        await loadThread();
      } catch (e) {
        error = 'Failed to initialize session';
        console.error('Session error:', e);
      }
    } else {
      error = 'No active session';
    }
  });

  async function loadThread() {
    if (!threadUri || !agent) return;

    isLoading = true;
    error = '';
    threadPosts = [];

    try {
      const response = await agent.getPostThread({ uri: threadUri });

      if (response.data.thread) {
        // Build the thread array from the tree structure
        const posts = [];

        // Add all parent posts first (if any)
        let current = response.data.thread;
        const parents = [];
        while (current.parent) {
          parents.unshift(current.parent);
          current = current.parent;
        }
        posts.push(...parents);

        // Add the main post
        posts.push(response.data.thread);

        // Add all reply posts in a flat structure
        function addReplies(post) {
          if (post.replies) {
            for (const reply of post.replies) {
              posts.push(reply);
              addReplies(reply);
            }
          }
        }
        addReplies(response.data.thread);

        // Deduplicate posts to prevent key collision errors
        const uniquePosts = [];
        const seenUris = new Set();

        for (const item of posts) {
          if (item.post && !seenUris.has(item.post.uri)) {
            seenUris.add(item.post.uri);
            uniquePosts.push({
              post: item.post,
              reply: item.reply,
              reason: item.reason,
            });
          }
        }
        threadPosts = uniquePosts;
      }
    } catch (e) {
      console.error('Thread fetch error:', e);
      error = e?.message || 'Failed to load thread.';
    } finally {
      isLoading = false;
    }
  }

  function goBack() {
    goto('/');
  }

  async function toggleLike(postUri, postCid, postIndex) {
    if (!session || !agent) return;

    const post = threadPosts[postIndex].post;
    const isLiked = post.viewer?.like;

    try {
      if (isLiked) {
        await agent.deleteLike(post.viewer.like);
        threadPosts[postIndex].post = {
          ...post,
          likeCount: (post.likeCount || 1) - 1,
          viewer: { ...post.viewer, like: undefined },
        };
      } else {
        const response = await agent.like(postUri, postCid);
        threadPosts[postIndex].post = {
          ...post,
          likeCount: (post.likeCount || 0) + 1,
          viewer: { ...post.viewer, like: response.uri },
        };
      }
      threadPosts = threadPosts;
    } catch (error) {
      console.error('Like/unlike error:', error);
    }
  }

  function showUserProfile(handle) {
    // Navigate back to home with profile parameter
    goto(`/?profile=${encodeURIComponent(handle)}`);
  }
</script>

<div class="min-h-screen bg-gray-900 text-white">
  <div class="max-w-2xl mx-auto">
    <!-- Header -->
    <div class="sticky top-0 z-10 bg-gray-800 border-b border-gray-700 p-4 flex items-center space-x-4">
      <button
        on:click={goBack}
        class="text-blue-400 hover:text-blue-300 text-lg"
        aria-label="Go back"
      >
        ← Back
      </button>
      <h1 class="text-xl font-bold">Thread</h1>
    </div>

    <!-- Content -->
    <div class="p-4">
      {#if isLoading}
        <div class="flex justify-center items-center py-8">
          <div class="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      {:else if error}
        <p class="text-red-400 text-center py-4">{error}</p>
      {:else if threadPosts.length > 0}
        <div class="space-y-4">
          {#each threadPosts as item, index (item.post.uri)}
            <article class="border-b border-gray-700 pb-4 last:border-b-0 flex space-x-4">
              <div>
                <img
                  src={item.post.author.avatar || 'https://placehold.co/48x48/1a202c/ffffff?text=?'}
                  alt={item.post.author.displayName}
                  class="w-10 h-10 rounded-full bg-gray-600"
                />
              </div>
              <div class="flex-1 overflow-hidden">
                <div class="flex items-center justify-between text-gray-400">
                  <div class="flex items-center space-x-2">
                    <button
                      on:click={() => showUserProfile(item.post.author.handle)}
                      class="font-bold text-white truncate hover:underline cursor-pointer text-sm"
                    >
                      {item.post.author.displayName || item.post.author.handle}
                    </button>
                    <button on:click={() => showUserProfile(item.post.author.handle)} class="text-xs truncate hover:underline cursor-pointer">
                      @{item.post.author.handle}
                    </button>
                    <span class="text-gray-500">&middot;</span>
                    <span class="text-gray-500 text-xs flex-shrink-0">{formatPostDate(item.post.record.createdAt)}</span>
                  </div>
                  <button
                    on:click={() => toggleLike(item.post.uri, item.post.cid, index)}
                    class="flex items-center space-x-1 hover:text-red-400 transition-colors flex-shrink-0"
                    aria-label={item.post.viewer?.like ? 'Unlike post' : 'Like post'}
                  >
                    <span class="text-sm">{item.post.viewer?.like ? '❤️' : '🤍'}</span>
                    {#if item.post.likeCount > 0}
                      <span class="text-xs">{item.post.likeCount}</span>
                    {/if}
                  </button>
                </div>

                <div
                  class="text-white mt-1 whitespace-pre-wrap break-words text-sm"
                  role="button"
                  tabindex="0"
                  on:click={(e) => {
                    const target = e.target;
                    if (target.dataset.mentionDid) {
                      const mentionText = target.textContent;
                      const handle = mentionText.startsWith('@') ? mentionText.slice(1) : mentionText;
                      showUserProfile(handle);
                    }
                  }}
                  on:keydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      const target = e.target;
                      if (target.dataset.mentionDid) {
                        const mentionText = target.textContent;
                        const handle = mentionText.startsWith('@') ? mentionText.slice(1) : mentionText;
                        showUserProfile(handle);
                        e.preventDefault();
                      }
                    }
                  }}
                >
                  {@html renderTextWithLinks(item.post.record.text, item.post.record.facets)}
                </div>

                {#if item.post.embed}
                  <div class="mt-2">
                    <EmbedRenderer embed={item.post.embed} className="" clickableImages={true} {showUserProfile} />
                  </div>
                {/if}
              </div>
            </article>
          {/each}
        </div>
      {:else}
        <p class="text-gray-400 text-center py-4">No posts found in thread.</p>
      {/if}
    </div>
  </div>
</div>
