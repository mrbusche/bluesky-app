<script>
  // Anchor specialized for wrapping an image. Consumers provide src & alt; styling is encapsulated here.
  // Adds external link defaults similar to Link.svelte.
  export let href = '#';
  export let src = '';
  export let alt = '';
  export let external = undefined; // boolean | undefined
  export let target = undefined; // string | undefined
  export let rel = undefined; // string | undefined

  const isExternal = (url) => /^(https?:)?\/\//i.test(url);

  $: isExt = external ?? isExternal(href);
  $: resolvedTarget = target ?? (isExt ? '_blank' : undefined);
  $: resolvedRel = rel ?? (isExt ? 'noopener noreferrer' : undefined);

  const imageClass = 'rounded-lg w-full h-auto object-cover border border-gray-600';
</script>

<a {href} target={resolvedTarget} rel={resolvedRel} {...$$restProps}>
  <img {src} {alt} class={imageClass} />
</a>
