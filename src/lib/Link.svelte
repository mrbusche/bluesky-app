<script>
  import { isExternalUrl } from './utils.js';
  // Reusable anchor component with sensible defaults for external links
  // Props:
  // - href: string (required)
  // - external?: boolean (auto-detected from href if not provided)
  // - target?: string (defaults to _blank for external links)
  // - rel?: string (defaults to noopener noreferrer for external links)
  // - Any other attributes (class, aria-*, title, etc.) are forwarded via $$restProps

  export let href = '#';
  export let external = undefined; // boolean | undefined
  export let target = undefined; // string | undefined
  export let rel = undefined; // string | undefined

  $: isExt = external ?? isExternalUrl(href);
  $: resolvedTarget = target ?? (isExt ? '_blank' : undefined);
  $: resolvedRel = rel ?? (isExt ? 'noopener noreferrer' : undefined);
</script>

<a {href} target={resolvedTarget} rel={resolvedRel} {...$$restProps}>
  <slot />
  <!--
    Usage examples:
    <Link href={url} class="text-blue-400 hover:underline">Open</Link>
    <Link href={url} external={false} class="block">Internal nav</Link>
  -->
</a>
