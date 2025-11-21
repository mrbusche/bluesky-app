<script>
  import Modal from './Modal.svelte';
  import EmbedRenderer from './EmbedRenderer.svelte';
  import { renderTextWithLinks, formatPostDate } from './utils.js';

  export let open = false;
  export let threadUri = '';
  export let agent = null;
  export let session = null;
  export let onClose = undefined;
  export let showUserProfile = () => {};

  let isLoading = false;
  let error = '';
  let threadPosts = [];

  async function loadThread() {
    if (!open || !threadUri || !agent) return;

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

  // Load thread when modal opens or threadUri changes
  $: if (open && threadUri) {
    loadThread();
  }

  function close() {
    onClose?.();
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

  // Touch handling for swipe to close
  let touchStartX = 0;
  let touchStartY = 0;

  function handleTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }

  function handleTouchEnd(e) {
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;

    const diffX = touchEndX - touchStartX;
    const diffY = Math.abs(touchEndY - touchStartY);

    // Swipe right (positive X diff), significant distance (>100), not too much vertical scroll (<100)
    if (diffX > 100 && diffY < 100) {
      close();
    }
  }
</script>

<Modal
  bind:open
  {close}
  ariaLabel="Thread dialog"
  containerClass="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
>
  <!-- Header -->
  <div class="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0">
    <h2 class="text-xl font-bold text-blue-400">Thread</h2>
    <button on:click={close} class="text-gray-400 hover:text-white text-2xl leading-none" aria-label="Close"> &times; </button>
  </div>

  <!-- Content -->
  <div class="flex-1 overflow-y-auto p-4" on:touchstart={handleTouchStart} on:touchend={handleTouchEnd}>
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

  <!-- Swipe hint -->
  {#if threadPosts.length > 0}
    <div class="px-4 py-2 text-center text-gray-500 text-xs border-t border-gray-700 flex-shrink-0">Swipe right to close</div>
  {/if}
</Modal>
