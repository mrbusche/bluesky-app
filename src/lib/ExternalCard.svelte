<script>
  import Link from './Link.svelte';

  // Generic external link card used for app.bsky.embed.external#view and similar
  // Props: uri (href), title, description?, thumb?
  export let uri = '';
  export let title = '';
  export let description = '';
  export let thumb = '';
  export let className = '';
</script>

<Link href={uri} class={`block border border-gray-600 rounded-lg overflow-hidden hover:border-gray-500 transition-colors ${className}`}>
  {#if thumb}
    <img src={thumb} alt={title} class="w-full h-48 object-cover bg-gray-700" />
  {/if}
  <div class="p-3 bg-gray-800">
    <div class="text-white font-semibold text-sm line-clamp-1">{title}</div>
    {#if description}
      <div class="text-gray-400 text-xs mt-1 line-clamp-2">{description}</div>
    {/if}
    <div class="text-gray-500 text-xs mt-1 truncate">{uri}</div>
  </div>
</Link>
