<script>
  import { renderTextWithLinks } from './utils.js';

  // Props
  export let quotedPost = null;
  export let className = '';
  export let showUserProfile = null; // Optional callback for handling mention clicks
</script>

{#if quotedPost}
  <div class={`border border-gray-600 rounded-lg p-3 ${className}`}>
    <div class="flex items-center space-x-2 text-sm text-gray-400">
      <img
        src={quotedPost.author?.avatar || 'https://placehold.co/24x24/1a202c/ffffff?text=?'}
        class="w-6 h-6 rounded-full bg-gray-600"
        alt={quotedPost.author?.displayName || quotedPost.author?.handle}
      />
      <span class="font-bold text-white">{quotedPost.author?.displayName || quotedPost.author?.handle}</span>
      <span class="truncate">@{quotedPost.author?.handle}</span>
    </div>
    <div class="text-white mt-2 text-sm whitespace-pre-wrap break-words" on:click={(e) => {
      if (showUserProfile) {
        const target = e.target;
        if (target.dataset.mentionDid) {
          const mentionText = target.textContent;
          const handle = mentionText.startsWith('@') ? mentionText.slice(1) : mentionText;
          showUserProfile(handle);
        }
      }
    }} on:keydown={(e) => {
      if (showUserProfile && (e.key === 'Enter' || e.key === ' ')) {
        const target = e.target;
        if (target.dataset.mentionDid) {
          const mentionText = target.textContent;
          const handle = mentionText.startsWith('@') ? mentionText.slice(1) : mentionText;
          showUserProfile(handle);
          e.preventDefault();
        }
      }
    }}>
      {@html renderTextWithLinks(quotedPost.value?.text, quotedPost.value?.facets)}
    </div>

    {#if quotedPost.embeds && quotedPost.embeds.length > 0}
      <slot embeds={quotedPost.embeds} />
    {/if}
  </div>
{/if}
