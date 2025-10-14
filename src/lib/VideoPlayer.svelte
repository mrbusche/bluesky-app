<script>
  import { onMount, onDestroy } from 'svelte';
  import Hls from 'hls.js';

  // Props
  export let playlist;
  export let poster = '';
  export let controls = true;
  export let preload = 'metadata';
  export let playsinline = true;
  export let muted = false;
  export let autoplay = false;

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
  {...$$restProps}
  class="rounded-lg w-full h-auto border border-gray-600"
>
  Your browser does not support the video tag.
  <source src={playlist} type="application/vnd.apple.mpegurl" />
  <source src={playlist} type="video/mp4" />
</video>
