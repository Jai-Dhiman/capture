<script lang="ts">
  import { onMount } from 'svelte';
  import { api, ApiError } from '$lib/api';
  import { CheckCircle, XCircle, Loader2, Database, Server } from 'lucide-svelte';

  interface HealthStatus {
    status: string;
    timestamp: string;
    database: string;
    dbCheck?: string;
    error?: string;
  }

  let healthStatus: HealthStatus | null = null;
  let loading = true;
  let error: string | null = null;
  let lastChecked: Date | null = null;

  async function checkHealth() {
    loading = true;
    error = null;
    
    try {
      healthStatus = await api.health();
      lastChecked = new Date();
    } catch (err) {
      if (err instanceof ApiError) {
        error = `API Error (${err.status}): ${err.message}`;
      } else {
        error = `Network Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
      }
      healthStatus = null;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    checkHealth();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  });
</script>

<svelte:head>
  <title>Dashboard - Capture API Health</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <div class="max-w-4xl mx-auto py-8 px-4">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Capture API Dashboard</h1>
      <p class="text-gray-600">Monitor your Cloudflare Workers API and D1 database status</p>
    </div>

    <!-- Health Status Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <!-- API Status Card -->
      <div class="bg-white rounded-lg shadow-sm border p-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center">
            <Server class="w-5 h-5 text-blue-500 mr-2" />
            <h2 class="text-lg font-semibold text-gray-900">API Status</h2>
          </div>
          
          {#if loading}
            <Loader2 class="w-5 h-5 text-gray-400 animate-spin" />
          {:else if error}
            <XCircle class="w-5 h-5 text-red-500" />
          {:else if healthStatus}
            <CheckCircle class="w-5 h-5 text-green-500" />
          {/if}
        </div>

        <div class="space-y-2">
          <div class="flex justify-between">
            <span class="text-sm text-gray-500">Status:</span>
            {#if loading}
              <span class="text-sm text-gray-500">Checking...</span>
            {:else if error}
              <span class="text-sm text-red-600">Error</span>
            {:else if healthStatus}
              <span class="text-sm text-green-600 capitalize">{healthStatus.status}</span>
            {/if}
          </div>
          
          {#if lastChecked}
            <div class="flex justify-between">
              <span class="text-sm text-gray-500">Last Checked:</span>
              <span class="text-sm text-gray-700">{lastChecked.toLocaleTimeString()}</span>
            </div>
          {/if}
        </div>
      </div>

      <!-- Database Status Card -->
      <div class="bg-white rounded-lg shadow-sm border p-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center">
            <Database class="w-5 h-5 text-purple-500 mr-2" />
            <h2 class="text-lg font-semibold text-gray-900">D1 Database</h2>
          </div>
          
          {#if loading}
            <Loader2 class="w-5 h-5 text-gray-400 animate-spin" />
          {:else if error || healthStatus?.database === 'error'}
            <XCircle class="w-5 h-5 text-red-500" />
          {:else if healthStatus?.database === 'connected'}
            <CheckCircle class="w-5 h-5 text-green-500" />
          {/if}
        </div>

        <div class="space-y-2">
          <div class="flex justify-between">
            <span class="text-sm text-gray-500">Connection:</span>
            {#if loading}
              <span class="text-sm text-gray-500">Checking...</span>
            {:else if error}
              <span class="text-sm text-red-600">Unknown</span>
            {:else if healthStatus}
              <span class="text-sm {healthStatus.database === 'connected' ? 'text-green-600' : 'text-red-600'} capitalize">
                {healthStatus.database}
              </span>
            {/if}
          </div>
          
          {#if healthStatus?.dbCheck}
            <div class="flex justify-between">
              <span class="text-sm text-gray-500">Records:</span>
              <span class="text-sm text-gray-700">{healthStatus.dbCheck}</span>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Error Display -->
    {#if error}
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div class="flex items-start">
          <XCircle class="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 class="text-sm font-semibold text-red-800 mb-1">Connection Error</h3>
            <p class="text-sm text-red-700">{error}</p>
            <p class="text-xs text-red-600 mt-2">Make sure your API server is running on the configured URL.</p>
          </div>
        </div>
      </div>
    {/if}

    <!-- Health Details -->
    {#if healthStatus}
      <div class="bg-white rounded-lg shadow-sm border p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Health Details</h3>
        <div class="bg-gray-50 rounded-md p-4">
          <pre class="text-sm text-gray-700 overflow-x-auto">{JSON.stringify(healthStatus, null, 2)}</pre>
        </div>
      </div>
    {/if}

    <!-- Refresh Button -->
    <div class="mt-6 flex justify-center">
      <button
        on:click={checkHealth}
        disabled={loading}
        class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {#if loading}
          <Loader2 class="w-4 h-4 mr-2 animate-spin" />
          Checking...
        {:else}
          <Server class="w-4 h-4 mr-2" />
          Refresh Health Check
        {/if}
      </button>
    </div>
  </div>
</div>
