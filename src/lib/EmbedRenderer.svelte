<script>
  import EmbedRenderer from './EmbedRenderer.svelte';
  import ExternalCard from './ExternalCard.svelte';
  import GifPlayer from './GifPlayer.svelte';
  import ImageGrid from './ImageGrid.svelte';
  import QuotedPost from './QuotedPost.svelte';
  import VideoPlayer from './VideoPlayer.svelte';

  // Props
  // - embed: object | object[]
  // - className: string applied to top-level rendered element for spacing (e.g., mt-3 or mt-2)
  // - clickableImages: when false, image grids render plain <img> instead of <a>
  // - showUserProfile: optional callback for handling mention clicks
  const { embed = null, className = '', clickableImages = true, showUserProfile = null } = $props();

  const isArray = (v) => Array.isArray(v);
</script>

{#if !embed}
  <!-- nothing -->
{:else if isArray(embed)}
  {#each embed as e}
    <EmbedRenderer embed={e} {className} {clickableImages} {showUserProfile} />
  {/each}
{:else}
  {#if embed.images}
    <ImageGrid images={embed.images} {className} link={clickableImages} />
  {/if}

  {#if embed.$type === 'app.bsky.embed.video#view' && embed.playlist}
    {#if embed.presentation === 'gif'}
      <div class={className}>
        <GifPlayer playlist={embed.playlist} poster={embed.thumbnail} alt={embed.alt} />
      </div>
    {:else}
      <div class={className}>
        <VideoPlayer playlist={embed.playlist} poster={embed.thumbnail} />
      </div>
    {/if}
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
    <QuotedPost quotedPost={embed.record} {className} {showUserProfile}>
      {#if embed.record.embeds && embed.record.embeds.length > 0}
        {#each embed.record.embeds as inner}
          <EmbedRenderer embed={inner} className="mt-2" clickableImages={false} {showUserProfile} />
        {/each}
      {/if}
    </QuotedPost>
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
      {#if embed.media.presentation === 'gif'}
        <div class={className}>
          <GifPlayer playlist={embed.media.playlist} poster={embed.media.thumbnail} alt={embed.media.alt} />
        </div>
      {:else}
        <div class={className}>
          <VideoPlayer playlist={embed.media.playlist} poster={embed.media.thumbnail} />
        </div>
      {/if}
    {/if}

    {#if embed.record?.record && !embed.record.record.notFound}
      <QuotedPost quotedPost={embed.record.record} {className} {showUserProfile}>
        {#if embed.record.record.embeds && embed.record.record.embeds.length > 0}
          {#each embed.record.record.embeds as inner}
            <EmbedRenderer embed={inner} className="mt-2" clickableImages={false} {showUserProfile} />
          {/each}
        {/if}
      </QuotedPost>
    {/if}
  {/if}
{/if}
