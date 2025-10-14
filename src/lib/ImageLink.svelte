<script>
  // Anchor specialized for wrapping an image. Accepts href and forwards other props.
  // Adds external link defaults similar to Link.svelte.
  export let href = '#';
  export let external = undefined; // boolean | undefined
  export let target = undefined; // string | undefined
  export let rel = undefined; // string | undefined

  const isExternal = (url) => /^(https?:)?\/\//i.test(url);

  $: isExt = external ?? isExternal(href);
  $: resolvedTarget = target ?? (isExt ? '_blank' : undefined);
  $: resolvedRel = rel ?? (isExt ? 'noopener noreferrer' : undefined);
</script>

<a {href} target={resolvedTarget} rel={resolvedRel} {...$$restProps}>
  <slot />
</a>
