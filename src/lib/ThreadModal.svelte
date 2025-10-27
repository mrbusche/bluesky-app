<script>
  import Modal from './Modal.svelte';
  import EmbedRenderer from './EmbedRenderer.svelte';
  import { renderTextWithLinks, formatPostDate } from './utils.js';

  // Props
  export let open = false;
  export let postUri = '';
  export let agent = null;
  export let onClose = undefined;

  // Local state
  let isLoading = false;
  let error = '';
  let thread = null;

  async function loadThread() {
    if (!open || !postUri || !agent) return;
    isLoading = true;
    error = '';
    thread = null;
    try {
      const response = await agent.getPostThread({ uri: postUri });
      thread = response.data.thread;
    } catch (e) {
      console.error('Thread fetch error:', e);
      error = e?.message || 'Failed to load thread.';
    } finally {
      isLoading = false;
    }
  }

  // Refetch whenever opened or postUri changes
  $: if (open && postUri) {
    loadThread();
  }

  function close() {
    onClose?.();
  }

  // Helper to get all posts from thread structure recursively
  function getThreadPosts(threadNode) {
    if (!threadNode) return [];
    
    const posts = [];
    
    // Get parent posts (going up the thread)
    if (threadNode.parent) {
      posts.push(...getThreadPosts(threadNode.parent));
    }
    
    // Add current post
    if (threadNode.post) {
      posts.push(threadNode.post);
    }
    
    // Get replies (going down the thread)
    if (threadNode.replies && Array.isArray(threadNode.replies)) {
      for (const reply of threadNode.replies) {
        posts.push(...getThreadPosts(reply));
      }
    }
    
    return posts;
  }

  $: threadPosts = thread ? getThreadPosts(thread) : [];
</script>

<Modal bind:open {close} ariaLabel="Thread dialog" containerClass="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
  <div class="flex justify-between items-start mb-4 sticky top-0 bg-gray-800 pb-2 z-10">
    <h2 id="thread-dialog-title" class="text-xl font-bold text-blue-400">Thread</h2>
    <button on:click={close} class="text-gray-400 hover:text-white text-2xl leading-none" aria-label="Close"> &times; </button>
  </div>

  {#if isLoading}
    <div class="flex justify-center items-center py-8">
      <div class="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
    </div>
  {:else if error}
    <p class="text-red-400 text-center py-4">{error}</p>
  {:else if threadPosts.length > 0}
    <div class="space-y-4">
      {#each threadPosts as post, index}
        <article class="border-b border-gray-700 pb-4 last:border-b-0">
          <div class="flex space-x-3">
            <div>
              <img
                src={post.author.avatar || 'https://placehold.co/48x48/1a202c/ffffff?text=?'}
                alt={post.author.displayName}
                class="w-10 h-10 rounded-full bg-gray-600"
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
    <p class="text-gray-400 text-center py-4">No posts found in thread.</p>
  {/if}
</Modal>
