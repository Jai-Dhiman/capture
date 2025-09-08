<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { FeedbackCategory, TicketFilters } from '$lib/types';
  import { Search, Filter, X } from 'lucide-svelte';

  export let categories: FeedbackCategory[] = [];
  export let filters: TicketFilters;
  export let loading: boolean = false;

  const dispatch = createEventDispatcher<{
    filtersChange: TicketFilters;
  }>();

  let searchInput = filters.search || '';
  let statusFilter = filters.status || '';
  let priorityFilter = filters.priority || '';
  let typeFilter = filters.type || '';
  let categoryFilter = filters.categoryId || '';

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'OPEN', label: 'Open' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'RESOLVED', label: 'Resolved' },
    { value: 'CLOSED', label: 'Closed' },
  ];

  const priorityOptions = [
    { value: '', label: 'All Priorities' },
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
    { value: 'URGENT', label: 'Urgent' },
  ];

  const typeOptions = [
    { value: '', label: 'All Types' },
    { value: 'FEEDBACK', label: 'Feedback' },
    { value: 'BUG_REPORT', label: 'Bug Report' },
    { value: 'FEATURE_REQUEST', label: 'Feature Request' },
    { value: 'SUPPORT', label: 'Support' },
  ];

  function handleSearch() {
    dispatch('filtersChange', {
      search: searchInput || undefined,
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
      type: typeFilter || undefined,
      categoryId: categoryFilter || undefined,
    });
  }

  function handleFilterChange() {
    dispatch('filtersChange', {
      search: searchInput || undefined,
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
      type: typeFilter || undefined,
      categoryId: categoryFilter || undefined,
    });
  }

  function clearFilters() {
    searchInput = '';
    statusFilter = '';
    priorityFilter = '';
    typeFilter = '';
    categoryFilter = '';
    handleFilterChange();
  }

  $: hasActiveFilters = searchInput || statusFilter || priorityFilter || typeFilter || categoryFilter;
</script>

<div class="bg-white rounded-lg shadow-sm border p-6">
  <div class="flex items-center justify-between mb-4">
    <div class="flex items-center">
      <Filter class="w-5 h-5 text-stone-500 mr-2" />
      <h3 class="text-lg font-medium text-stone-900">Filters</h3>
    </div>
    
    {#if hasActiveFilters}
      <button
        type="button"
        class="inline-flex items-center px-3 py-2 text-sm font-medium text-stone-600 hover:text-stone-900"
        on:click={clearFilters}
        disabled={loading}
      >
        <X class="w-4 h-4 mr-1" />
        Clear filters
      </button>
    {/if}
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <!-- Search -->
    <div class="lg:col-span-2">
      <label for="search" class="block text-sm font-medium text-stone-700 mb-1">
        Search tickets
      </label>
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search class="h-4 w-4 text-stone-400" />
        </div>
        <input
          id="search"
          type="text"
          class="block w-full pl-10 pr-3 py-2 border border-stone-300 rounded-md text-sm placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Search by subject, description, or user..."
          bind:value={searchInput}
          on:input={handleSearch}
          on:keydown={(e) => e.key === 'Enter' && handleSearch()}
          disabled={loading}
        />
      </div>
    </div>

    <!-- Status Filter -->
    <div>
      <label for="status" class="block text-sm font-medium text-stone-700 mb-1">
        Status
      </label>
      <select
        id="status"
        class="block w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        bind:value={statusFilter}
        on:change={handleFilterChange}
        disabled={loading}
      >
        {#each statusOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </div>

    <!-- Priority Filter -->
    <div>
      <label for="priority" class="block text-sm font-medium text-stone-700 mb-1">
        Priority
      </label>
      <select
        id="priority"
        class="block w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        bind:value={priorityFilter}
        on:change={handleFilterChange}
        disabled={loading}
      >
        {#each priorityOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </div>

    <!-- Type Filter -->
    <div>
      <label for="type" class="block text-sm font-medium text-stone-700 mb-1">
        Type
      </label>
      <select
        id="type"
        class="block w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        bind:value={typeFilter}
        on:change={handleFilterChange}
        disabled={loading}
      >
        {#each typeOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </div>

    <!-- Category Filter -->
    <div>
      <label for="category" class="block text-sm font-medium text-stone-700 mb-1">
        Category
      </label>
      <select
        id="category"
        class="block w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        bind:value={categoryFilter}
        on:change={handleFilterChange}
        disabled={loading}
      >
        <option value="">All Categories</option>
        {#each categories as category}
          <option value={category.id}>{category.name}</option>
        {/each}
      </select>
    </div>
  </div>
</div>