<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { FeedbackTicket } from '$lib/types';
  import TicketCard from './TicketCard.svelte';
  import { ChevronLeft, ChevronRight } from 'lucide-svelte';

  export let tickets: FeedbackTicket[] = [];
  export let totalCount: number = 0;
  export let hasNextPage: boolean = false;
  export let currentOffset: number = 0;
  export let pageSize: number = 20;

  const dispatch = createEventDispatcher<{
    pageChange: number;
    ticketUpdate: void;
  }>();

  let selectedTicket: FeedbackTicket | null = null;

  $: safePageSize = Math.max(1, pageSize || 1);
  $: currentPage  = Math.floor(currentOffset   / safePageSize) + 1;
  $: totalPages   = Math.ceil (totalCount      / safePageSize);
  $: hasPrevPage  = currentOffset > 0;
  function handlePrevPage() {
    if (hasPrevPage) {
      dispatch('pageChange', Math.max(0, currentOffset - pageSize));
    }
  }

  function handleNextPage() {
    if (hasNextPage) {
      dispatch('pageChange', currentOffset + pageSize);
    }
  }

  function handleTicketSelect(ticket: FeedbackTicket) {
    selectedTicket = ticket;
  }

  function handleTicketUpdate() {
    selectedTicket = null;
    dispatch('ticketUpdate');
  }
</script>

<div class="bg-white rounded-lg shadow-sm border">
  <!-- Header -->
  <div class="px-6 py-4 border-b border-stone-200">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-medium text-stone-900">
        Tickets ({totalCount})
      </h2>
      
      <!-- Pagination -->
      {#if totalPages > 1}
        <div class="flex items-center space-x-2">
          <span class="text-sm text-stone-600">
            Page {currentPage} of {totalPages}
          </span>
          
          <div class="flex items-center space-x-1">
            <button
              type="button"
              class="p-2 text-stone-400 hover:text-stone-600 disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={handlePrevPage}
              disabled={!hasPrevPage}
            >
              <ChevronLeft class="w-4 h-4" />
            </button>
            
            <button
              type="button"
              class="p-2 text-stone-400 hover:text-stone-600 disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={handleNextPage}
              disabled={!hasNextPage}
            >
              <ChevronRight class="w-4 h-4" />
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Tickets List -->
  <div class="divide-y divide-stone-200">
    {#each tickets as ticket (ticket.id)}
      <TicketCard
        {ticket}
        on:select={() => handleTicketSelect(ticket)}
        on:statusUpdate={handleTicketUpdate}
      />
    {/each}

    {#if tickets.length === 0}
      <div class="px-6 py-12 text-center">
        <p class="text-stone-500">No tickets found matching your filters.</p>
      </div>
    {/if}
  </div>

  <!-- Footer with pagination -->
  {#if totalPages > 1}
    <div class="px-6 py-4 border-t border-stone-200">
      <div class="flex items-center justify-between">
        <p class="text-sm text-stone-600">
          Showing {currentOffset + 1} to {Math.min(currentOffset + pageSize, totalCount)} of {totalCount} tickets
        </p>
        
        <div class="flex items-center space-x-2">
          <button
            type="button"
            class="px-3 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 disabled:opacity-50 disabled:cursor-not-allowed"
            on:click={handlePrevPage}
            disabled={!hasPrevPage}
          >
            Previous
          </button>
          
          <button
            type="button"
            class="px-3 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 disabled:opacity-50 disabled:cursor-not-allowed"
            on:click={handleNextPage}
            disabled={!hasNextPage}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Ticket Detail Modal -->
{#if selectedTicket}
  {#await import('./TicketDetail.svelte') then TicketDetailModule}
    <TicketDetailModule.default
      ticket={selectedTicket}
      on:close={() => selectedTicket = null}
      on:update={handleTicketUpdate}
    />
  {/await}
{/if}