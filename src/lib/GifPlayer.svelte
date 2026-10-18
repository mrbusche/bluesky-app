<script>
  import { onMount } from 'svelte';

  // GifPlayer - Renders animated GIFs that come as video embeds with presentation='gif'
  // GIFs in Bluesky use the same HLS playlist format as videos, but should loop and play automatically
  const { playlist, poster = '', alt = 'Animated GIF', ...rest } = $props();

  let videoEl = undefined;
  let hls;
  let observer;

  onMount(() => {
    if (!videoEl || !playlist) return;

    let cancelled = false;

    // Load hls.js lazily so it stays out of the main bundle
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return;
      if (Hls.isSupported()) {
        // HLS.js is preferred; Chrome reports native HLS support but fails to play it
        hls = new Hls({ enableWorker: true, lowLatencyMode: false });
        hls.loadSource(playlist);
        hls.attachMedia(videoEl);
      } else {
        // Native HLS (Safari) or fallback
        videoEl.src = playlist;
      }
    });

    // Auto-play when in viewport for GIFs
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && videoEl.paused) {
              videoEl.play().catch(() => {});
            } else if (!entry.isIntersecting && !videoEl.paused) {
              videoEl.pause();
            }
          });
        },
        { threshold: 0.5 },
      );
      observer.observe(videoEl);
    }

    return () => {
      cancelled = true;
      if (hls) {
        hls.destroy();
        hls = null;
      }
      if (observer) {
        observer.disconnect();
      }
    };
  });
</script>

<video
  bind:this={videoEl}
  {poster}
  autoplay
  muted
  loop
  playsinline
  preload="metadata"
  class="h-auto w-full rounded-lg border border-gray-600"
  {...rest}
  aria-label={alt}
>
  Your browser does not support the video tag.
</video>
