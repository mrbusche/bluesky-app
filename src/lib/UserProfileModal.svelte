<script>
  import { createEventDispatcher } from 'svelte';

  // Props
  export let open = false; // controls visibility
  export let handle = ''; // user handle to load
  export let agent = null; // AtpAgent instance
  export let session = null; // session object (optional, for follow/unfollow)

  const dispatch = createEventDispatcher();

  // Local state
  let isLoading = false;
  let error = '';
  let profile = null;
  let isFollowing = false;

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
  $: if (open && handle) {
    loadProfile();
  }

  function close() {
    dispatch('close');
  }

  async function follow() {
    if (!profile || !session) return;
    isFollowing = true;
    try {
      const response = await agent.follow(profile.did);
      profile = { ...profile, viewer: { ...profile.viewer, following: response.uri } };
    } catch (e) {
      console.error('Follow error:', e);
      error = e?.message || 'Failed to follow user.';
    } finally {
      isFollowing = false;
    }
  }

  async function unfollow() {
    if (!profile || !session || !profile.viewer?.following) return;
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

{#if open}
  <div
    class="fixed inset-0 bg-black bg-opacity-75 z-30 flex items-center justify-center p-4"
    role="button"
    tabindex="0"
    aria-label="Close profile overlay"
    on:click|self={close}
    on:keydown={(e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    }}
  >
    <div
      class="bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-dialog-title"
    >
      <div class="flex justify-between items-start mb-4">
        <h2 id="profile-dialog-title" class="text-xl font-bold text-blue-400">Profile</h2>
        <button on:click={close} class="text-gray-400 hover:text-white text-2xl leading-none" aria-label="Close"> &times; </button>
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

           {#if !profile.viewer?.following}
             <button
               on:click={follow}
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
               on:click={unfollow}
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

           {#if error}
             <p class="text-red-400 text-sm text-center">{error}</p>
           {/if}
         </div>
      {:else if error}
        <p class="text-red-400 text-center py-4">{error}</p>
      {/if}
    </div>
  </div>
{/if}
