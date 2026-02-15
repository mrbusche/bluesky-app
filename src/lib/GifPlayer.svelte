<script>
  import Hls from 'hls.js';
  import { onMount } from 'svelte';

  // GifPlayer - Renders animated GIFs that come as video embeds with presentation='gif'
  // GIFs in Bluesky use the same HLS playlist format as videos, but should loop and play automatically
  const { playlist, poster = '', alt = 'Animated GIF', ...rest } = $props();

  let videoEl;
  let hls;
  let observer;

  onMount(() => {
    if (!videoEl || !playlist) return;

    if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      videoEl.src = playlist;
    } else if (Hls.isSupported()) {
      // HLS.js for other browsers
      hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(playlist);
      hls.attachMedia(videoEl);
    } else {
      // Fallback
      videoEl.src = playlist;
    }

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
  class="rounded-lg w-full h-auto border border-gray-600"
  {...rest}
  aria-label={alt}
>
  Your browser does not support the video tag.
</video>
