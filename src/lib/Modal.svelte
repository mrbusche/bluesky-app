<script>
  import { onDestroy, onMount } from 'svelte';
  import { browser } from '$app/environment';

  const {
    open = $bindable(false),
    closeOnOverlay = true,
    closeOnEsc = true,
    ariaLabel = 'Dialog',
    containerClass = 'bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6',
    close,
    children,
  } = $props();

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
  $effect(() => {
    if (browser) {
      document.body.classList.toggle('modal-open', !!open);
    }
  });

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
    onclick={(e) => {
      if (e.target === e.currentTarget && closeOnOverlay) {
        handleClose();
      }
    }}
    role="button"
    tabindex="0"
    aria-label={ariaLabel}
    onkeydown={handleOverlayKeydown}
  >
    <div role="dialog" aria-modal="true" aria-label={ariaLabel} class={containerClass}>
      {@render children?.()}
    </div>
  </div>
{/if}

<style>
  /* Tailwind classes are used; no additional scoped styles. */
  :global(body.modal-open) {
    overflow: hidden;
  }
</style>
