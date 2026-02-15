<script>
  import Hls from 'hls.js';
  import { onMount } from 'svelte';

  // Props
  const {
    playlist,
    poster = '',
    controls = true,
    preload = 'metadata',
    playsinline = true,
    muted = false,
    autoplay = false,
    ...rest
  } = $props();

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

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) {
              if (!videoEl.paused) {
                videoEl.pause();
              }
            } else if (autoplay && videoEl.paused) {
              videoEl.play().catch(() => {});
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
  {controls}
  {preload}
  {poster}
  {playsinline}
  {muted}
  {...rest}
  class="rounded-lg w-full h-auto border border-gray-600"
>
  Your browser does not support the video tag.
</video>
