<script>
  import Link from './Link.svelte';

  // Generic external link card used for app.bsky.embed.external#view and similar
  // Props: uri (href), title, description?, thumb?
  const { uri = '', title = '', description = '', thumb = '', className = '' } = $props();
</script>

<Link href={uri} class={`block overflow-hidden rounded-lg border border-gray-600 transition-colors hover:border-gray-500 ${className}`}>
  {#if thumb}
    <img src={thumb} alt={title} class="h-48 w-full bg-gray-700 object-cover" />
  {/if}
  <div class="bg-gray-800 p-3">
    <h2 class="line-clamp-1 text-sm font-semibold text-white">{title}</h2>
    {#if description}
      <p class="mt-1 line-clamp-2 text-xs text-gray-400">{description}</p>
    {/if}
    <div class="mt-1 truncate text-xs text-gray-500">{uri}</div>
  </div>
</Link>
