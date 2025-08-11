<script lang="ts">
  import type { ComponentType } from 'svelte';
  import { TrendingUp, TrendingDown } from 'lucide-svelte';

  export let title: string;
  export let value: string | number;
  export let icon: ComponentType;
  export let iconColor: string = 'text-blue-500';
  export let subtitle: string = '';
  export let trend: 'up' | 'down' | 'neutral' | null = null;
  export let trendValue: string = '';
  export let loading: boolean = false;
</script>

<div class="bg-white rounded-lg shadow-sm border p-6">
  <div class="flex items-center justify-between mb-4">
    <div class="flex items-center">
      <svelte:component this={icon} class="w-5 h-5 {iconColor} mr-2" />
      <h3 class="text-sm font-medium text-gray-900">{title}</h3>
    </div>
    
    {#if trend && trendValue}
      <div class="flex items-center text-sm">
        {#if trend === 'up'}
          <TrendingUp class="w-4 h-4 text-green-500 mr-1" />
          <span class="text-green-600">+{trendValue}</span>
        {:else if trend === 'down'}
          <TrendingDown class="w-4 h-4 text-red-500 mr-1" />
          <span class="text-red-600">-{trendValue}</span>
        {/if}
      </div>
    {/if}
  </div>

  <div class="space-y-1">
    {#if loading}
      <div class="animate-pulse">
        <div class="h-8 bg-gray-200 rounded w-20 mb-2"></div>
        <div class="h-4 bg-gray-200 rounded w-16"></div>
      </div>
    {:else}
      <div class="text-2xl font-bold text-gray-900">{value}</div>
      {#if subtitle}
        <div class="text-sm text-gray-500">{subtitle}</div>
      {/if}
    {/if}
  </div>
</div>