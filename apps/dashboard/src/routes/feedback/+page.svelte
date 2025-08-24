<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { AdminTicketConnection, FeedbackCategory, TicketFilters } from '$lib/types';
  import TicketQueue from '$lib/components/feedback/TicketQueue.svelte';
  import TicketFiltersComponent from '$lib/components/feedback/TicketFilters.svelte';
  import TicketStats from '$lib/components/feedback/TicketStats.svelte';
  import { MessageSquare, AlertTriangle, Clock, CheckCircle } from 'lucide-svelte';

  let ticketData: AdminTicketConnection | null = null;
  let categories: FeedbackCategory[] = [];
  let loading = true;
  let error: string | null = null;

  let filters: TicketFilters & { limit?: number; offset?: number } = {
    limit: 20,
    offset: 0
  };

  async function loadTickets() {
    try {
      loading = true;
      error = null;
      
      const [ticketsResponse, categoriesResponse] = await Promise.all([
        api.feedback.getAdminTickets(filters),
        api.feedback.getCategories()
      ]);
      
      ticketData = ticketsResponse.adminTickets;
      categories = categoriesResponse.feedbackCategories;
    } catch (err) {
      console.error('Failed to load tickets:', err);
      error = err instanceof Error ? err.message : 'Failed to load tickets';
    } finally {
      loading = false;
    }
  }

  function handleFilterChange(newFilters: TicketFilters) {
    filters = { ...filters, ...newFilters, offset: 0 };
    loadTickets();
  }

  function handlePageChange(offset: number) {
    filters = { ...filters, offset };
    loadTickets();
  }

  onMount(loadTickets);
</script>

<svelte:head>
  <title>Feedback Tickets - Capture Dashboard</title>
</svelte:head>

<div class="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-stone-900">Feedback Tickets</h1>
        <p class="text-stone-600 mt-2">Manage user feedback, bug reports, and support requests</p>
      </div>
      
      <div class="flex items-center space-x-4">
        <span class="inline-flex items-center px-3 py-2 text-sm font-medium text-stone-600">
          <MessageSquare class="w-4 h-4 mr-2" />
          Support Dashboard
        </span>
      </div>
    </div>

    {#if error}
      <div class="bg-red-50 border border-red-200 rounded-lg p-4">
        <div class="flex items-center">
          <AlertTriangle class="w-5 h-5 text-red-500 mr-2" />
          <span class="text-red-700">{error}</span>
        </div>
      </div>
    {/if}

    <!-- Stats Overview -->
    {#if ticketData?.stats}
      <TicketStats stats={ticketData.stats} {loading} />
    {/if}

    <!-- Filters -->
    <TicketFiltersComponent 
      {categories} 
      {filters} 
      {loading}
      on:filtersChange={(e) => handleFilterChange(e.detail)} 
    />

    <!-- Tickets -->
    {#if loading}
      <div class="bg-white rounded-lg shadow-sm border p-6">
        <div class="animate-pulse space-y-4">
          {#each Array(5) as _}
            <div class="border-b border-stone-200 pb-4">
              <div class="flex items-start justify-between">
                <div class="space-y-2 flex-1">
                  <div class="h-4 bg-stone-200 rounded w-3/4"></div>
                  <div class="h-3 bg-stone-200 rounded w-1/2"></div>
                  <div class="h-3 bg-stone-200 rounded w-1/4"></div>
                </div>
                <div class="h-6 bg-stone-200 rounded w-16 ml-4"></div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {:else if ticketData}
      <TicketQueue 
        tickets={ticketData.tickets}
        totalCount={ticketData.totalCount}
        hasNextPage={ticketData.hasNextPage}
        currentOffset={filters.offset || 0}
        pageSize={filters.limit || 20}
        on:pageChange={(e) => handlePageChange(e.detail)}
        on:ticketUpdate={loadTickets}
      />
    {:else}
      <div class="bg-white rounded-lg shadow-sm border p-6 text-center">
        <CheckCircle class="w-12 h-12 text-stone-400 mx-auto mb-4" />
        <h3 class="text-lg font-medium text-stone-900 mb-2">No tickets found</h3>
        <p class="text-stone-600">No feedback tickets match your current filters.</p>
      </div>
    {/if}
  </div>
</div>