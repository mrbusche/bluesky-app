<script>
  import Link from './Link.svelte';
  import { auth } from './auth.svelte.js';

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

<div class="min-h-screen flex items-center justify-center p-4">
  <div class="w-full max-w-sm bg-gray-800 rounded-lg shadow-lg p-8">
    <h1 class="text-3xl font-bold text-center mb-2 text-blue-400">Bluesky Client</h1>
    <p class="text-center text-gray-400 mb-6">Log in to view your feed.</p>
    <form
      onsubmit={(e) => {
        e.preventDefault();
        handleLogin();
      }}
    >
      <div class="mb-4">
        <label for="handle" class="block text-gray-300 text-sm font-bold mb-2">Bluesky Handle</label>
        <input
          type="text"
          id="handle"
          bind:value={handle}
          class="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="example.bsky.social"
          required
        />
      </div>
      <div class="mb-6">
        <label for="password" class="block text-gray-300 text-sm font-bold mb-2">App Password</label>
        <input
          type="password"
          id="password"
          bind:value={password}
          class="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="xxxx-xxxx-xxxx-xxxx"
          required
        />
        <p class="text-xs text-gray-500 mt-2">
          Use an <Link href="https://bsky.app/settings/app-passwords" class="text-blue-400 hover:underline">App Password</Link> for security.
        </p>
      </div>
      <button
        type="submit"
        disabled={isLoading}
        class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:shadow-outline transition duration-150 ease-in-out disabled:bg-blue-800 disabled:cursor-not-allowed"
      >
        {#if isLoading}
          Logging in...
        {:else}
          Login
        {/if}
      </button>
      {#if loginError}
        <p class="text-red-400 text-sm mt-4 text-center">{loginError}</p>
      {/if}
    </form>
  </div>
</div>
