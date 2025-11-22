<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { AtpAgent } from '@atproto/api';
  import FeedPost from '$lib/FeedPost.svelte';
  import UserProfileModal from '$lib/UserProfileModal.svelte';
  import '../../../app.css';

  const BLUESKY_SERVICE = 'https://bsky.social';
  const SESSION_KEY = 'blueskySession';

  let agent = null;
  let session = null;
  let threadPosts = [];
  let loading = true;
  let error = '';

  // Profile modal state
  let showProfile = false;
  let profileHandle = '';

  // The ID parameter is the URI of the post
  $: uri = decodeURIComponent($page.params.id);

  onMount(async () => {
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (!savedSession) {
      // No session, redirect to home
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

    // Add parents (recursively)
    if (thread.parent) {
      posts = [...flattenThread(thread.parent)];
    }

    // Add current post
    if (thread.post) {
      posts.push({
        post: thread.post,
        reply: thread.parent ? { parent: thread.parent.post } : undefined,
      });
    }

    // Add replies
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

  async function toggleLike(event) {
    if (!session || !agent) return;
    const { item } = event.detail;
    const post = item.post;
    const isLiked = post.viewer?.like;

    // Optimistic update
    threadPosts = threadPosts.map((entry) => {
      if (entry.post.uri === post.uri) {
        const likeCount = (entry.post.likeCount || 0) + (isLiked ? -1 : 1);
        return {
          ...entry,
          post: {
            ...entry.post,
            likeCount: likeCount < 0 ? 0 : likeCount,
            viewer: { ...entry.post.viewer, like: isLiked ? undefined : 'pending' },
          },
        };
      }
      return entry;
    });

    try {
      if (isLiked) {
        await agent.deleteLike(post.viewer.like);
        // Finalize update (remove 'pending' URI or keep undefined)
        threadPosts = threadPosts.map((entry) => {
          if (entry.post.uri === post.uri) return { ...entry, post: { ...entry.post, viewer: { ...entry.post.viewer, like: undefined } } };
          return entry;
        });
      } else {
        const response = await agent.like(post.uri, post.cid);
        // Finalize update with real URI
        threadPosts = threadPosts.map((entry) => {
          if (entry.post.uri === post.uri)
            return { ...entry, post: { ...entry.post, viewer: { ...entry.post.viewer, like: response.uri } } };
          return entry;
        });
      }
    } catch (error) {
      console.error('Like/unlike error:', error);
      // Revert on error (simplified)
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
        <FeedPost {item} isThreadView={true} on:like={toggleLike} on:profile={(e) => handleUserProfile(e.detail.handle)} />
        {#if item !== threadPosts[threadPosts.length - 1]}
          <div class="w-0.5 h-4 bg-gray-700 mx-auto my-0"></div>
        {/if}
      {/each}

      <div class="p-8 text-center text-gray-500 text-sm">End of thread</div>
    {/if}
  </div>
</div>
