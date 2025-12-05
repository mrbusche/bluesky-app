<script>
  import Modal from './Modal.svelte';

  // Props
  let { open = $bindable(false), handle = '', agent = null, session = null, onClose } = $props();

  // Local state
  let isLoading = $state(false);
  let error = $state('');
  let profile = $state(null);
  let isFollowing = $state(false);

  async function loadProfile() {
    if (!open || !handle || !agent) return;
    isLoading = true;
    error = '';
    profile = null;
    try {
      const response = await agent.getProfile({ actor: handle });
      profile = response.data;
    } catch (e) {
      console.error('Profile fetch error:', e);
      error = e?.message || 'Failed to load profile.';
    } finally {
      isLoading = false;
    }
  }

  // Refetch whenever opened or handle changes
  $effect(() => {
    if (open && handle) {
      loadProfile();
    }
  });

  function close() {
    onClose?.();
  }

  async function follow() {
    if (!profile || !session || !agent) return;
    error = '';
    isFollowing = true;
    try {
      const { uri } = await agent.follow(profile.did);
      profile = {
        ...profile,
        viewer: { ...(profile.viewer ?? {}), following: uri },
      };
    } catch (e) {
      console.error('Follow error:', e);
      error = e?.message || 'Failed to follow user.';
    } finally {
      isFollowing = false;
    }
  }

  async function unfollow() {
    if (!profile || !session || !profile.viewer?.following) return;
    error = '';
    isFollowing = true;
    try {
      await agent.deleteFollow(profile.viewer.following);
      profile = { ...profile, viewer: { ...profile.viewer, following: undefined } };
    } catch (e) {
      console.error('Unfollow error:', e);
      error = e?.message || 'Failed to unfollow user.';
    } finally {
      isFollowing = false;
    }
  }
</script>

<Modal bind:open {close} ariaLabel="Profile dialog">
  <div class="flex justify-between items-start mb-4">
    <h2 id="profile-dialog-title" class="text-xl font-bold text-blue-400">Profile</h2>
    <button onclick={close} class="text-gray-400 hover:text-white text-2xl leading-none" aria-label="Close"> &times; </button>
  </div>

  {#if isLoading}
    <div class="flex justify-center items-center py-8">
      <div class="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
    </div>
  {:else if profile}
    <div class="space-y-4">
      <div class="flex items-center space-x-4">
        <img
          src={profile.avatar || 'https://placehold.co/64x64/1a202c/ffffff?text=?'}
          alt={profile.displayName}
          class="w-16 h-16 rounded-full bg-gray-600"
        />
        <div class="flex-1">
          <h3 class="font-bold text-white text-lg">{profile.displayName || profile.handle}</h3>
          <p class="text-gray-400 text-sm">@{profile.handle}</p>
        </div>
      </div>

      {#if profile.description}
        <p class="text-white whitespace-pre-wrap break-words">{profile.description}</p>
      {/if}

      <div class="flex space-x-4 text-sm text-gray-400">
        <span><strong class="text-white">{profile.followersCount || 0}</strong> followers</span>
        <span><strong class="text-white">{profile.followsCount || 0}</strong> following</span>
        <span><strong class="text-white">{profile.postsCount || 0}</strong> posts</span>
      </div>

      {#if session}
        {#if !profile.viewer?.following}
          <button
            onclick={follow}
            disabled={isFollowing}
            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-150 ease-in-out disabled:bg-blue-800 disabled:cursor-not-allowed"
          >
            {#if isFollowing}
              Following...
            {:else}
              Follow
            {/if}
          </button>
        {:else}
          <button
            onclick={unfollow}
            disabled={isFollowing}
            class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition duration-150 ease-in-out disabled:bg-green-800 disabled:cursor-not-allowed"
          >
            {#if isFollowing}
              Unfollowing...
            {:else}
              Following
            {/if}
          </button>
        {/if}
      {/if}

      {#if error}
        <p class="text-red-400 text-sm text-center">{error}</p>
      {/if}
    </div>
  {:else if error}
    <p class="text-red-400 text-center py-4">{error}</p>
  {/if}
</Modal>
