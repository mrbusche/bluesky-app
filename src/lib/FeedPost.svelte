<script>
  import EmbedRenderer from './EmbedRenderer.svelte';
  import FeedPost from './FeedPost.svelte';
  import { renderTextWithLinks, formatPostDate, sharePost } from './utils.js';

  let { item, isThreadView = false, connectUp = false, connectDown = false, onlike, onprofile } = $props();

  let isSelfThread = $derived(!isThreadView && item.post.record.reply && item.reply?.parent?.author?.did === item.post.author.did);
  let rootPost = $derived(item.reply?.root);
  let showRoot = $derived(isSelfThread && rootPost?.$type === 'app.bsky.feed.defs#postView' && !connectUp);
  let effectiveConnectUp = $derived(connectUp || showRoot);
  let shareStatus = $state('');

  function handleLike() {
    onlike?.({ item });
  }

  function handleProfileClick(handle) {
    onprofile?.({ handle });
  }

  function handleMentionClick(e) {
    const target = e.target;
    if (target.dataset.mentionDid) {
      const mentionText = target.textContent;
      const handle = mentionText.startsWith('@') ? mentionText.slice(1) : mentionText;
      handleProfileClick(handle);
      e.preventDefault();
      e.stopPropagation();
    }
  }

  async function handleShare() {
    const result = await sharePost(item.post);
    if (result.success && result.method === 'clipboard') {
      // If we used clipboard, show feedback
      shareStatus = 'copied';
      setTimeout(() => {
        shareStatus = '';
      }, 2000);
    }
  }
</script>

{#if showRoot}
  <FeedPost item={{ post: rootPost }} isThreadView={true} connectDown={true} {onlike} {onprofile} />
{/if}

<article class="p-4 border-b border-gray-700 flex space-x-4 {isThreadView ? 'bg-gray-900' : ''} relative" id={item.post.uri}>
  <div class="flex-shrink-0 flex flex-col items-center relative self-stretch" style="width: 48px;">
    {#if effectiveConnectUp}
      <div class="absolute top-[-16px] h-[16px] w-0.5 bg-gray-600 left-1/2 -translate-x-1/2"></div>
    {/if}

    <button
      type="button"
      class="w-12 h-12 rounded-full bg-gray-600 cursor-pointer z-10 relative p-0 border-none"
      onclick={(e) => {
        e.stopPropagation();
        handleProfileClick(item.post.author.handle);
      }}
      aria-label={`View profile of ${item.post.author.displayName}`}
    >
      <img
        src={item.post.author.avatar || 'https://placehold.co/48x48/1a202c/ffffff?text=?'}
        alt={item.post.author.displayName}
        class="w-full h-full rounded-full"
      />
    </button>

    {#if connectDown}
      <div class="absolute top-[48px] bottom-[-16px] w-0.5 bg-gray-600 left-1/2 -translate-x-1/2"></div>
    {/if}
  </div>

  <div class="flex-1 overflow-hidden">
    {#if item.reason && item.reason.$type === 'app.bsky.feed.defs#reasonRepost'}
      <div class="flex items-center space-x-2 text-gray-400 text-sm mb-2">
        <span>🔁</span>
        <span>Reposted by</span>
        <span class="font-semibold text-gray-300">{item.reason.by.displayName || item.reason.by.handle}</span>
      </div>
    {/if}

    {#if isSelfThread && !showRoot}
      <div class="flex items-center space-x-2 text-gray-400 text-sm mb-2">
        <span>🧵</span>
        <span>Thread</span>
      </div>
    {/if}

    <div class="flex items-center justify-between text-gray-400">
      <div class="flex items-center space-x-2 overflow-hidden">
        <button
          onclick={(e) => {
            e.stopPropagation();
            handleProfileClick(item.post.author.handle);
          }}
          class="font-bold text-white truncate hover:underline cursor-pointer"
          aria-label={`View profile of ${item.post.author.displayName || item.post.author.handle}`}
        >
          {item.post.author.displayName || item.post.author.handle}
        </button>
        <button
          onclick={(e) => {
            e.stopPropagation();
            handleProfileClick(item.post.author.handle);
          }}
          class="text-sm truncate hidden sm:inline hover:underline cursor-pointer"
          aria-label={`View profile @${item.post.author.handle}`}
        >
          @{item.post.author.handle}
        </button>
        <span class="text-gray-500 flex-shrink-0">&middot;</span>
        <span class="text-gray-500 text-sm flex-shrink-0">{formatPostDate(item.post.record.createdAt)}</span>
      </div>

      <div class="flex items-center space-x-2 flex-shrink-0 ml-2">
        <button
          onclick={(e) => {
            e.stopPropagation();
            handleShare();
          }}
          class="flex items-center space-x-1 hover:text-blue-400 transition-colors relative"
          aria-label="Share post"
          title={shareStatus === 'copied' ? 'Copied to clipboard!' : 'Share post'}
        >
          <span class="text-lg">🔗</span>
          {#if shareStatus === 'copied'}
            <span class="text-xs absolute -bottom-5 left-0 text-blue-400 whitespace-nowrap" role="status" aria-live="polite"
              >Copied!</span
            >
          {/if}
        </button>
        <button
          onclick={(e) => {
            e.stopPropagation();
            handleLike();
          }}
          class="flex items-center space-x-1 hover:text-red-400 transition-colors"
          aria-label={item.post.viewer?.like ? 'Unlike post' : 'Like post'}
        >
          <span class="text-lg">{item.post.viewer?.like ? '❤️' : '🤍'}</span>
          {#if item.post.likeCount > 0}
            <span class="text-sm">{item.post.likeCount}</span>
          {/if}
        </button>
      </div>
    </div>

    <div
      class="text-white mt-1 whitespace-pre-wrap break-words"
      onclick={handleMentionClick}
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleMentionClick(e)}
      role="button"
      tabindex="0"
    >
      {@html renderTextWithLinks(item.post.record.text, item.post.record.facets)}
    </div>

    {#if item.post.embed}
      <EmbedRenderer embed={item.post.embed} className="mt-3" clickableImages={true} showUserProfile={handleProfileClick} />
    {/if}
  </div>
</article>
