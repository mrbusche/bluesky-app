<script>
  import ImageGrid from './ImageGrid.svelte';
  import ExternalCard from './ExternalCard.svelte';
  import VideoPlayer from './VideoPlayer.svelte';
  import { renderTextWithLinks } from './utils.js';

  // Props
  // - embed: object | object[]
  // - className: string applied to top-level rendered element for spacing (e.g., mt-3 or mt-2)
  // - clickableImages: when false, image grids render plain <img> instead of <a>
  export let embed = null;
  export let className = '';
  export let clickableImages = true;

  const isArray = (v) => Array.isArray(v);
</script>

{#if !embed}
  <!-- nothing -->
{:else if isArray(embed)}
  {#each embed as e}
    <svelte:self embed={e} {className} {clickableImages} />
  {/each}
{:else}
  {#if embed.images}
    <ImageGrid images={embed.images} {className} link={clickableImages} />
  {/if}

  {#if embed.$type === 'app.bsky.embed.video#view' && embed.playlist}
    <div class={className}>
      <VideoPlayer playlist={embed.playlist} poster={embed.thumbnail} />
    </div>
  {/if}

  {#if embed.$type === 'app.bsky.embed.external#view' && embed.external}
    <ExternalCard
      {className}
      uri={embed.external.uri}
      title={embed.external.title}
      description={embed.external.description}
      thumb={embed.external.thumb}
    />
  {/if}

  {#if embed.$type === 'app.bsky.embed.record#view' && embed.record && !embed.record.notFound}
    {@const quotedPost = embed.record}
    <div class={`border border-gray-600 rounded-lg p-3 ${className}`}>
      <div class="flex items-center space-x-2 text-sm text-gray-400">
        <img
          src={quotedPost.author?.avatar || 'https://placehold.co/24x24/1a202c/ffffff?text=?'}
          class="w-6 h-6 rounded-full bg-gray-600"
          alt={quotedPost.author?.displayName}
        />
        <span class="font-bold text-white">{quotedPost.author?.displayName || quotedPost.author?.handle}</span>
        <span class="truncate">@{quotedPost.author?.handle}</span>
      </div>
      <div class="text-white mt-2 text-sm whitespace-pre-wrap break-words">
        {@html renderTextWithLinks(quotedPost.value?.text, quotedPost.value?.facets)}
      </div>

      {#if quotedPost.embeds && quotedPost.embeds.length > 0}
        {#each quotedPost.embeds as inner}
          <svelte:self embed={inner} className="mt-2" clickableImages={false} />
        {/each}
      {/if}
    </div>
  {/if}

  {#if embed.$type === 'app.bsky.embed.recordWithMedia#view'}
    {#if embed.media?.$type === 'app.bsky.embed.external#view' && embed.media.external}
      <ExternalCard
        {className}
        uri={embed.media.external.uri}
        title={embed.media.external.title}
        description={embed.media.external.description}
        thumb={embed.media.external.thumb}
      />
    {/if}

    {#if embed.media?.images}
      <ImageGrid images={embed.media.images} {className} link={clickableImages} />
    {/if}

    {#if embed.media?.$type === 'app.bsky.embed.video#view' && embed.media.playlist}
      <div class={className}>
        <VideoPlayer playlist={embed.media.playlist} poster={embed.media.thumbnail} />
      </div>
    {/if}

    {#if embed.record?.record && !embed.record.record.notFound}
      {@const quotedPost = embed.record.record}
      <div class={`border border-gray-600 rounded-lg p-3 ${className}`}>
        <div class="flex items-center space-x-2 text-sm text-gray-400">
          <img
            src={quotedPost.author?.avatar || 'https://placehold.co/24x24/1a202c/ffffff?text=?'}
            class="w-6 h-6 rounded-full bg-gray-600"
            alt={quotedPost.author?.displayName}
          />
          <span class="font-bold text-white">{quotedPost.author?.displayName || quotedPost.author?.handle}</span>
          <span class="truncate">@{quotedPost.author?.handle}</span>
        </div>
        <div class="text-white mt-2 text-sm whitespace-pre-wrap break-words">
          {@html renderTextWithLinks(quotedPost.value?.text, quotedPost.value?.facets)}
        </div>

        {#if quotedPost.embeds && quotedPost.embeds.length > 0}
          {#each quotedPost.embeds as inner}
            <svelte:self embed={inner} className="mt-2" clickableImages={false} />
          {/each}
        {/if}
      </div>
    {/if}
  {/if}
{/if}
