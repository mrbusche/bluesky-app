<script>
  import { onMount, onDestroy } from 'svelte';
  import Hls from 'hls.js';

  // Props
  let {
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
  });

  onDestroy(() => {
    if (hls) {
      hls.destroy();
      hls = null;
    }
  });
</script>

<video
  bind:this={videoEl}
  {controls}
  {preload}
  {poster}
  {playsinline}
  {muted}
  {autoplay}
  {...rest}
  class="rounded-lg w-full h-auto border border-gray-600"
>
  Your browser does not support the video tag.
</video>
