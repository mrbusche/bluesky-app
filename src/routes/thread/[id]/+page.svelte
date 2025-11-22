<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { AtpAgent } from '@atproto/api';
  import FeedPost from '$lib/FeedPost.svelte';
  import UserProfileModal from '$lib/UserProfileModal.svelte';
  import { toggleLike as toggleLikeUtil } from '$lib/utils';
  import { BLUESKY_SERVICE, SESSION_KEY } from '$lib/constants.js';
  import '../../../app.css';

  let agent = null;
  let session = null;
  let threadPosts = [];
  let loading = true;
  let error = '';

  let showProfile = false;
  let profileHandle = '';

  $: uri = decodeURIComponent($page.params.id);

  onMount(async () => {
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (!savedSession) {
      goto('/');
      return;
    }

    try {
      agent = new AtpAgent({ service: BLUESKY_SERVICE });
      const sessionData = JSON.parse(savedSession);
      await agent.resumeSession(sessionData);
      session = agent.session;

      await fetchThread();
    } catch (e) {
      console.error('Session resume failed or thread fetch failed', e);
      error = 'Could not load thread. Please try logging in again.';
      loading = false;
    }
  });

  async function fetchThread() {
    loading = true;
    try {
      const { data } = await agent.getPostThread({ uri: uri });
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

  function flattenThread(thread) {
    let posts = [];
    if (thread.parent) {
      posts = [...flattenThread(thread.parent)];
    }
    if (thread.post) {
      posts.push({
        post: thread.post,
        reply: thread.parent ? { parent: thread.parent.post } : undefined,
      });
    }
    if (thread.replies && thread.replies.length > 0) {
      const sortedReplies = thread.replies.sort((a, b) => new Date(a.post.record.createdAt) - new Date(b.post.record.createdAt));
      for (const reply of sortedReplies) {
        posts.push({
          post: reply.post,
          reply: { parent: thread.post },
        });
      }
    }
    return posts;
  }

  // Updated toggleLike signature
  async function toggleLike({ item }) {
    if (!session || !agent) return;
    const post = item.post;

    try {
      await toggleLikeUtil(agent, post, (uri, changes) => {
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

<UserProfileModal open={showProfile} handle={profileHandle} {agent} {session} onClose={() => (showProfile = false)} />

<div class="min-h-screen bg-gray-900 text-gray-200 pb-12">
  <header class="sticky top-0 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700 p-4 flex items-center space-x-4 z-10">
    <a href="/" class="text-blue-400 font-bold flex items-center hover:text-blue-300 transition-colors">
      <span class="text-xl mr-1">&larr;</span> Back to Feed
    </a>
    <h2 class="text-xl font-bold text-white">Thread</h2>
  </header>

  <div class="max-w-2xl mx-auto">
    {#if loading}
      <div class="flex justify-center py-12">
        <div class="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    {:else if error}
      <div class="p-8 text-red-400 text-center">{error}</div>
      <div class="text-center">
        <a href="/" class="text-blue-400 hover:underline">Return home</a>
      </div>
    {:else}
      {#each threadPosts as item (item.post.uri)}
        <FeedPost {item} isThreadView={true} onlike={toggleLike} onprofile={(e) => handleUserProfile(e.handle)} />
        {#if item !== threadPosts[threadPosts.length - 1]}
          <div class="w-0.5 h-4 bg-gray-700 mx-auto my-0"></div>
        {/if}
      {/each}

      <div class="p-8 text-center text-gray-500 text-sm">End of thread</div>
    {/if}
  </div>
</div>
