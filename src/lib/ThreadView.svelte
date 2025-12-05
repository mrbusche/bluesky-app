<script>
  import { onMount } from 'svelte';
  import FeedPost from './FeedPost.svelte';
  import { fade, fly } from 'svelte/transition';
  import { flattenThread } from '$lib/utils';

  let { startPost, agent, onClose, onLike, onProfile } = $props();

  let threadPosts = $state([]);
  let loading = $state(true);
  let error = $state('');
  let container = $state();

  // Swipe detection
  let touchStartX = $state(0);
  let touchStartY = $state(0);

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
  ontouchstart={handleTouchStart}
  ontouchend={handleTouchEnd}
  bind:this={container}
>
  <header class="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex items-center space-x-4 z-10">
    <button onclick={onClose} class="text-blue-400 font-bold flex items-center">
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
        <FeedPost {item} isThreadView={true} onlike={onLike} onprofile={(e) => onProfile(e.handle)} />
        {#if item !== threadPosts[threadPosts.length - 1]}
          <div class="w-0.5 h-4 bg-gray-700 mx-auto my-0"></div>
        {/if}
      {/each}
    {/if}
  </div>
</div>
