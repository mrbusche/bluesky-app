<script>
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
  {controls}
  {preload}
  {poster}
  {playsinline}
  {muted}
  {...rest}
  class="h-auto w-full rounded-lg border border-gray-600"
>
  Your browser does not support the video tag.
</video>
