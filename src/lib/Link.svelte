<script>
  import { isExternalUrl } from './utils.js';
  // Reusable anchor component with sensible defaults for external links
  // Props:
  // - href: string (required)
  // - external?: boolean (auto-detected from href if not provided)
  // - target?: string (defaults to _blank for external links)
  // - rel?: string (defaults to noopener noreferrer for external links)
  // - Any other attributes (class, aria-*, title, etc.) are forwarded via rest props

  let { href = '#', external, target, rel, children, ...rest } = $props();

  let isExt = $derived(external ?? isExternalUrl(href));
  let resolvedTarget = $derived(target ?? (isExt ? '_blank' : undefined));
  let resolvedRel = $derived(rel ?? (isExt ? 'noopener noreferrer' : undefined));
</script>

<a {href} target={resolvedTarget} rel={resolvedRel} {...rest}>
  {@render children?.()}
  <!--
    Usage examples:
    <Link href={url} class="text-blue-400 hover:underline">Open</Link>
    <Link href={url} external={false} class="block">Internal nav</Link>
  -->
</a>
