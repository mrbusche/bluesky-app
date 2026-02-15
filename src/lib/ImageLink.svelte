<script>
  import { isExternalUrl } from './utils.js';

  // Anchor specialized for wrapping an image. Consumers provide src & alt; styling is encapsulated here.
  // Adds external link defaults similar to Link.svelte.
  const { href = '#', src = '', alt = '', external, target, rel, ...rest } = $props();

  const isExt = $derived(external ?? isExternalUrl(href));
  const resolvedTarget = $derived(target ?? (isExt ? '_blank' : undefined));
  const resolvedRel = $derived(rel ?? (isExt ? 'noopener noreferrer' : undefined));

  const imageClass = 'rounded-lg w-full h-auto object-cover border border-gray-600';
</script>

<a {href} target={resolvedTarget} rel={resolvedRel} {...rest}>
  <img {src} {alt} class={imageClass} />
</a>
