<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  export let open = false;
  export let closeOnOverlay = true;
  export let closeOnEsc = true;
  export const ariaLabel = 'Dialog';
  export const containerClass = 'bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6';
  export let close = undefined;

  function handleClose() {
    close?.();
  }

  function handleKeydown(e) {
    if (closeOnEsc && e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  }

  function handleOverlayKeydown(e) {
    if (!closeOnOverlay) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClose();
    }
  }

  // Add/remove keydown listener on mount/unmount (browser only)
  onMount(() => {
    if (browser) {
      window.addEventListener('keydown', handleKeydown);
    }
  });

  // Keep body scroll locked in sync with `open` (browser only)
  $: if (browser) {
    document.body.classList.toggle('modal-open', !!open);
  }

  // Ensure cleanup on destroy in case component unmounts while open
  onDestroy(() => {
    if (browser) {
      window.removeEventListener('keydown', handleKeydown);
      document.body.classList.remove('modal-open');
    }
  });
</script>

{#if open}
  <div
    class="fixed inset-0 bg-black bg-opacity-75 z-30 flex items-center justify-center p-4"
    on:click|self={() => closeOnOverlay && handleClose()}
    role="button"
    tabindex="0"
    aria-label={ariaLabel}
    on:keydown={handleOverlayKeydown}
  >
    <div role="dialog" aria-modal="true" aria-label={ariaLabel} class={containerClass}>
      <slot />
    </div>
  </div>
{/if}

<style>
  /* Tailwind classes are used; no additional scoped styles. */
  :global(body.modal-open) {
    overflow: hidden;
  }
</style>
