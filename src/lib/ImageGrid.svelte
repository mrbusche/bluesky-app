<script>
  import ImageLink from './ImageLink.svelte';

  // images: Array<{ thumb?: string, fullsize?: string, alt?: string }>
  const { images = [], className = '', link = true } = $props();
</script>

{#if images && images.length > 0}
  <div class={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${className}`}>
    {#each images as img}
      {#if img.fullsize || img.thumb}
        {#if link}
          <ImageLink href={img.fullsize || img.thumb} src={img.thumb || img.fullsize} alt={img.alt || 'Embedded image'} />
        {:else}
          <img
            src={img.thumb || img.fullsize}
            alt={img.alt || 'Embedded image'}
            class="h-auto w-full rounded-lg border border-gray-600 object-cover"
          />
        {/if}
      {/if}
    {/each}
  </div>
{/if}
