<script>
  import { onMount } from 'svelte';
  import FeedPost from './FeedPost.svelte';
  import { fade, fly } from 'svelte/transition';

  export let startPost; // The post object that started the view
  export let agent;
  export let onClose;
  export let onLike; // Pass like handler back up
  export let onProfile; // Pass profile handler back up

  let threadPosts = [];
  let loading = true;
  let error = '';
  let container;

  // Swipe detection
  let touchStartX = 0;
  let touchStartY = 0;

  onMount(async () => {
    document.body.style.overflow = 'hidden';
    try {
      // Fetch the full thread structure
      const { data } = await agent.getPostThread({ uri: startPost.post.uri });
      if (data.thread) {
        threadPosts = flattenThread(data.thread);
      }
    } catch (e) {
      console.error('Failed to load thread', e);
      error = 'Could not load full thread.';
      // Fallback to just showing the passed post if fetch fails
      threadPosts = [startPost];
    } finally {
      loading = false;
    }

    return () => {
      document.body.style.overflow = '';
    };
  });

  // Flatten the recursive thread structure into a linear array for display
  function flattenThread(thread) {
    let posts = [];

    // Add parents (recursively)
    if (thread.parent) {
      posts = [...flattenThread(thread.parent)];
    }

    // Add current post
    if (thread.post) {
      // Convert to the format FeedPost expects (similar to timeline item)
      posts.push({
        post: thread.post,
        // We don't always have reason/reply context in the thread view the same way,
        // but we construct a basic item
        reply: thread.parent ? { parent: thread.parent.post } : undefined,
      });
    }

    // Add replies (we generally just want the linear conversation,
    // but if there are multiple replies, we might just show the main chain or immediate replies)
    // For this view, let's strictly show the chain leading to the selected post
    // and maybe immediate replies if the selected post is the parent.
    // However, the requirement is "view all posts in the thread".
    // A linear conversation usually implies following the replies of the author.

    if (thread.replies && thread.replies.length > 0) {
      // Sort by time
      const sortedReplies = thread.replies.sort((a, b) => new Date(a.post.record.createdAt) - new Date(b.post.record.createdAt));

      // We add all replies to the flattened list
      for (const reply of sortedReplies) {
        // We only recurse if it's part of the same conversation "thread" visually
        // For simplicity in this view, let's flatten one level deep or
        // checking if it's the same author to keep the "Thread" feel
        posts.push({
          post: reply.post,
          reply: { parent: thread.post },
        });

        // If we wanted deep recursion for replies-to-replies:
        // posts = [...posts, ...flattenReplies(reply)];
      }
    }

    return posts;
  }

  function handleTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }

  function handleTouchEnd(e) {
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;

    const xDiff = touchEndX - touchStartX;
    const yDiff = Math.abs(touchEndY - touchStartY);

    // Swipe right (min 75px) and mostly horizontal
    if (xDiff > 75 && yDiff < 50) {
      onClose();
    }
  }
</script>

<div
  class="fixed inset-0 z-50 bg-gray-900 overflow-y-auto"
  transition:fly={{ x: 300, duration: 200 }}
  on:touchstart={handleTouchStart}
  on:touchend={handleTouchEnd}
  bind:this={container}
>
  <header class="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex items-center space-x-4 z-10">
    <button on:click={onClose} class="text-blue-400 font-bold flex items-center">
      <span class="text-xl mr-1">&larr;</span> Back
    </button>
    <h2 class="text-xl font-bold text-white">Thread</h2>
  </header>

  <div class="max-w-2xl mx-auto pb-20 min-h-screen">
    {#if loading}
      <div class="flex justify-center py-8">
        <div class="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    {:else if error}
      <div class="p-4 text-red-400 text-center">{error}</div>
    {:else}
      {#each threadPosts as item (item.post.uri)}
        <FeedPost {item} isThreadView={true} on:like={onLike} on:profile={(e) => onProfile(e.detail.handle)} />
        {#if item !== threadPosts[threadPosts.length - 1]}
          <div class="w-0.5 h-4 bg-gray-700 mx-auto my-0"></div>
        {/if}
      {/each}
    {/if}
  </div>
</div>
