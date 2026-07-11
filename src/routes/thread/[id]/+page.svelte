<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { auth } from '$lib/auth.svelte.js';
  import FeedPost from '$lib/FeedPost.svelte';
  import UserProfileModal from '$lib/UserProfileModal.svelte';
  import { flattenThread, toggleLike as toggleLikeUtil } from '$lib/utils';
  import { onMount } from 'svelte';

  import '../../../app.css';

  let threadPosts = $state([]);
  let loading = $state(true);
  let error = $state('');

  let showProfile = $state(false);
  let profileHandle = $state('');

  const uri = $derived(decodeURIComponent($page.params.id));

  $effect(() => {
    if (auth.agent && uri) {
      fetchThread();
    }
  });

  onMount(async () => {
    await auth.init();
    if (!auth.session) {
      goto('/');
      return;
    }
  });

  async function fetchThread() {
    loading = true;
    try {
      const { data } = await auth.agent.getPostThread({ uri: uri });
      if (data.thread) {
        threadPosts = flattenThread(data.thread);
      }
    } catch (e) {
      console.error('Fetch thread error:', e);
      error = 'Failed to fetch thread data.';
    } finally {
      loading = false;
    }
  }

  // Updated toggleLike signature
  async function toggleLike({ item }) {
    if (!auth.session || !auth.agent) return;
    const post = item.post;

    try {
      await toggleLikeUtil(auth.agent, post, (uri, changes) => {
        threadPosts = threadPosts.map((entry) => {
          if (entry.post.uri === uri) {
            return {
              ...entry,
              post: {
                ...entry.post,
                ...changes,
              },
            };
          }
          return entry;
        });
      });
    } catch (error) {
      fetchThread();
    }
  }

  function handleUserProfile(handle) {
    profileHandle = handle;
    showProfile = true;
  }
</script>

<UserProfileModal
  open={showProfile}
  handle={profileHandle}
  agent={auth.agent}
  session={auth.session}
  onClose={() => (showProfile = false)}
/>

<div class="min-h-screen bg-gray-900 pb-12 text-gray-200">
  <header class="sticky top-0 z-10 flex items-center space-x-4 border-b border-gray-700 bg-gray-900/95 p-4 backdrop-blur-sm">
    <a href="/" class="flex items-center font-bold text-blue-400 transition-colors hover:text-blue-300">
      <span class="mr-1 text-xl">&larr;</span> Back to Feed
    </a>
    <h2 class="text-xl font-bold text-white">Thread</h2>
  </header>

  <div class="mx-auto max-w-2xl">
    {#if loading}
      <div class="flex justify-center py-12">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-400 border-t-transparent"></div>
      </div>
    {:else if error}
      <div class="p-8 text-center text-red-400">{error}</div>
      <div class="text-center">
        <a href="/" class="text-blue-400 hover:underline">Return home</a>
      </div>
    {:else}
      {#each threadPosts as item (item.post.uri)}
        <FeedPost {item} isThreadView={true} onlike={toggleLike} onprofile={(e) => handleUserProfile(e.handle)} />
        {#if item !== threadPosts[threadPosts.length - 1]}
          <div class="mx-auto my-0 h-4 w-0.5 bg-gray-700"></div>
        {/if}
      {/each}

      <div class="p-8 text-center text-sm text-gray-500">End of thread</div>
    {/if}
  </div>
</div>
