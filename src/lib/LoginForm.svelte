<script>
  import { auth } from './auth.svelte.js';
  import Link from './Link.svelte';

  let { onLoginSuccess } = $props();

  // Form input bindings
  let handle = $state('');
  let password = $state('');

  // UI State
  let isLoading = $state(false);
  let loginError = $state('');

  async function handleLogin() {
    if (isLoading) return;
    isLoading = true;
    loginError = '';

    const result = await auth.login(handle.trim(), password.trim());

    if (result.success) {
      onLoginSuccess?.();
    } else {
      loginError = result.error;
    }
    isLoading = false;
  }
</script>

<div class="flex min-h-screen items-center justify-center p-4">
  <div class="w-full max-w-sm rounded-lg bg-gray-800 p-8 shadow-lg">
    <h1 class="mb-2 text-center text-3xl font-bold text-blue-400">Bluesky Client</h1>
    <p class="mb-6 text-center text-gray-400">Log in to view your feed.</p>
    <form
      onsubmit={(e) => {
        e.preventDefault();
        handleLogin();
      }}
    >
      <div class="mb-4">
        <label for="handle" class="mb-2 block text-sm font-bold text-gray-300">Bluesky Handle</label>
        <input
          type="text"
          id="handle"
          bind:value={handle}
          class="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 leading-tight text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="example.bsky.social"
          required
        />
      </div>
      <div class="mb-6">
        <label for="password" class="mb-2 block text-sm font-bold text-gray-300">App Password</label>
        <input
          type="password"
          id="password"
          bind:value={password}
          class="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 leading-tight text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="xxxx-xxxx-xxxx-xxxx"
          required
        />
        <p class="mt-2 text-xs text-gray-500">
          Use an <Link href="https://bsky.app/settings/app-passwords" class="text-blue-400 hover:underline">App Password</Link> for security.
        </p>
      </div>
      <button
        type="submit"
        disabled={isLoading}
        class="focus:shadow-outline w-full rounded-md bg-blue-600 px-4 py-2 font-bold text-white transition duration-150 ease-in-out hover:bg-blue-700 focus:outline-none disabled:cursor-not-allowed disabled:bg-blue-800"
      >
        {#if isLoading}
          Logging in...
        {:else}
          Login
        {/if}
      </button>
      {#if loginError}
        <p class="mt-4 text-center text-sm text-red-400">{loginError}</p>
      {/if}
    </form>
  </div>
</div>
