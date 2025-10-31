<script>
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { AtpAgent } from '@atproto/api';
  import EmbedRenderer from '$lib/EmbedRenderer.svelte';
  import { renderTextWithLinks, formatPostDate } from '$lib/utils.js';

  const SESSION_KEY = 'blueskySession';
  const BLUESKY_SERVICE = 'https://bsky.social';

  let agent = null;
  let session = null;
  let isLoading = true;
  let error = '';
  let thread = null;
  let threadPosts = [];

  // Decode the URI from the URL parameter
  $: postUri = $page.params.uri ? decodeURIComponent($page.params.uri) : '';

  onMount(async () => {
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (!savedSession) {
      goto('/');
      return;
    }

    agent = new AtpAgent({ service: BLUESKY_SERVICE });
    try {
      const sessionData = JSON.parse(savedSession);
      await agent.resumeSession(sessionData);
      session = agent.session;
      await loadThread();
    } catch (err) {
      console.error('Failed to resume session:', err);
      localStorage.removeItem(SESSION_KEY);
      goto('/');
    }
  });

  async function loadThread() {
    if (!postUri || !agent) return;
    isLoading = true;
    error = '';
    thread = null;

    try {
      const response = await agent.getPostThread({ uri: postUri });
      thread = response.data.thread;
      threadPosts = getThreadPosts(thread);
    } catch (e) {
      console.error('Thread fetch error:', e);
      error = e?.message || 'Failed to load thread.';
    } finally {
      isLoading = false;
    }
  }

  // Helper to get all posts from thread structure recursively, filtering to show only author's posts
  function getThreadPosts(threadNode, authorDid = null) {
    if (!threadNode) return [];

    const posts = [];

    // Set the author DID from the main post if not set
    if (authorDid === null && threadNode.post) {
      authorDid = threadNode.post.author.did;
    }

    // Get parent posts (going up the thread)
    if (threadNode.parent) {
      posts.push(...getThreadPosts(threadNode.parent, authorDid));
    }

    // Add current post only if it's by the thread author
    if (threadNode.post && threadNode.post.author.did === authorDid) {
      posts.push(threadNode.post);
    }

    // Get replies (going down the thread)
    if (threadNode.replies && Array.isArray(threadNode.replies)) {
      for (const reply of threadNode.replies) {
        posts.push(...getThreadPosts(reply, authorDid));
      }
    }

    return posts;
  }

  function goBack() {
    goto('/');
  }
</script>

<svelte:head>
  <title>Thread - Bluesky App</title>
</svelte:head>

<div class="min-h-screen bg-gray-900 text-white">
  <header class="sticky top-0 bg-gray-900 bg-opacity-80 backdrop-blur-md z-10 border-b border-gray-700">
    <div class="flex items-center p-4 max-w-2xl mx-auto">
      <button
        on:click={goBack}
        class="text-blue-400 hover:text-blue-300 mr-4 text-2xl"
        aria-label="Back to feed"
      >
        ←
      </button>
      <h1 class="text-xl font-bold text-blue-400">Thread</h1>
    </div>
  </header>

  <main class="max-w-2xl mx-auto">
    {#if isLoading}
      <div class="flex justify-center items-center py-16">
        <div class="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    {:else if error}
      <div class="p-8 text-center">
        <p class="text-red-400 mb-4">{error}</p>
        <button
          on:click={goBack}
          class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-150 ease-in-out"
        >
          Back to Feed
        </button>
      </div>
    {:else if threadPosts.length > 0}
      <div class="divide-y divide-gray-700">
        {#each threadPosts as post}
          <article class="p-4">
            <div class="flex space-x-3">
              <div>
                <img
                  src={post.author.avatar || 'https://placehold.co/48x48/1a202c/ffffff?text=?'}
                  alt={post.author.displayName}
                  class="w-12 h-12 rounded-full bg-gray-600"
                />
              </div>
              <div class="flex-1 overflow-hidden">
                <div class="flex items-center space-x-2 text-gray-400">
                  <span class="font-bold text-white truncate">
                    {post.author.displayName || post.author.handle}
                  </span>
                  <span class="text-sm truncate">@{post.author.handle}</span>
                  <span class="text-gray-500">&middot;</span>
                  <span class="text-gray-500 text-sm">{formatPostDate(post.record.createdAt)}</span>
                </div>
                <div class="text-white mt-1 whitespace-pre-wrap break-words">
                  {@html renderTextWithLinks(post.record.text, post.record.facets)}
                </div>
                {#if post.embed}
                  <EmbedRenderer embed={post.embed} className="mt-3" clickableImages={true} />
                {/if}
              </div>
            </div>
          </article>
        {/each}
      </div>
    {:else}
      <div class="p-8 text-center">
        <p class="text-gray-400 mb-4">No posts found in thread.</p>
        <button
          on:click={goBack}
          class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-150 ease-in-out"
        >
          Back to Feed
        </button>
      </div>
    {/if}
  </main>
</div>

<style>
  :global(body) {
    background-color: #1a202c;
    color: #e2e8f0;
  }
</style>
