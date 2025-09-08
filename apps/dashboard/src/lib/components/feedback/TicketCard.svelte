<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { FeedbackTicket } from '$lib/types';
  import { api } from '$lib/api';
  import { 
    User, 
    Clock, 
    MessageSquare, 
    AlertTriangle, 
    CheckCircle2, 
    Circle,
    MoreHorizontal,
    Bug,
    Lightbulb,
    HelpCircle,
    MessageCircle,
    Smartphone,
    Monitor,
    Tablet
  } from 'lucide-svelte';

  export let ticket: FeedbackTicket;

  const dispatch = createEventDispatcher<{
    select: void;
    statusUpdate: void;
  }>();

  let showStatusMenu = false;
  let updating = false;

  const statusConfig = {
    OPEN: { icon: Circle, color: 'text-orange-500', bg: 'bg-orange-50', label: 'Open' },
    IN_PROGRESS: { icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50', label: 'In Progress' },
    RESOLVED: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50', label: 'Resolved' },
    CLOSED: { icon: CheckCircle2, color: 'text-stone-500', bg: 'bg-stone-50', label: 'Closed' },
  };

  const priorityConfig = {
    LOW: { color: 'text-stone-500', bg: 'bg-stone-50', label: 'Low' },
    MEDIUM: { color: 'text-blue-500', bg: 'bg-blue-50', label: 'Medium' },
    HIGH: { color: 'text-orange-500', bg: 'bg-orange-50', label: 'High' },
    URGENT: { color: 'text-red-500', bg: 'bg-red-50', label: 'Urgent' },
  };

  const typeConfig = {
    FEEDBACK: { icon: MessageCircle, color: 'text-blue-500', label: 'Feedback' },
    BUG_REPORT: { icon: Bug, color: 'text-red-500', label: 'Bug Report' },
    FEATURE_REQUEST: { icon: Lightbulb, color: 'text-green-500', label: 'Feature Request' },
    SUPPORT: { icon: HelpCircle, color: 'text-purple-500', label: 'Support' },
  };

  function getDeviceIcon(platform?: string) {
    if (!platform) return Monitor;
    const p = platform.toLowerCase();
    if (p.includes('ios') || p.includes('android')) return Smartphone;
    if (p.includes('tablet') || p.includes('ipad')) return Tablet;
    return Monitor;
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      dispatch('select');
    }
  }

  async function updateStatus(newStatus: string) {
    if (updating) return;
    
    try {
      updating = true;
      await api.feedback.updateTicketStatus(ticket.id, newStatus);
      dispatch('statusUpdate');
      showStatusMenu = false;
    } catch (error) {
      console.error('Failed to update ticket status:', error);
      // TODO: Show error toast
    } finally {
      updating = false;
    }
  }

  $: status = statusConfig[ticket.status];
  $: priority = priorityConfig[ticket.priority];
  $: type = typeConfig[ticket.type];
  $: DeviceIcon = getDeviceIcon(ticket.deviceInfo?.platform);
</script>

<div 
  class="px-6 py-4 hover:bg-stone-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
  role="button"
  tabindex="0"
  on:click={() => dispatch('select')}
  on:keydown={handleKeydown}
>
  <div class="flex items-start justify-between">
    <div class="flex-1 min-w-0">
      <!-- Header -->
      <div class="flex items-center space-x-3 mb-2">
        <!-- Type Icon -->
        <div class="flex-shrink-0">
          <svelte:component this={type.icon} class="w-5 h-5 {type.color}" />
        </div>
        
        <!-- Subject -->
        <h3 class="text-sm font-medium text-stone-900 truncate">
          {ticket.subject}
        </h3>
        
        <!-- Priority Badge -->
        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium {priority.color} {priority.bg}">
          {priority.label}
        </span>
      </div>

      <!-- Description -->
      <p class="text-sm text-stone-600 line-clamp-2 mb-3">
        {ticket.description}
      </p>

      <!-- Meta Information -->
      <div class="flex items-center space-x-4 text-xs text-stone-500">
        <!-- User -->
        <div class="flex items-center space-x-1">
          <User class="w-3 h-3" />
          <span>@{ticket.user.username}</span>
        </div>
        
        <!-- Category -->
        <div class="flex items-center space-x-1">
          <span>{ticket.category.name}</span>
        </div>
        
        <!-- Device Info -->
        {#if ticket.deviceInfo?.platform}
          <div class="flex items-center space-x-1">
            <svelte:component this={DeviceIcon} class="w-3 h-3" />
            <span>{ticket.deviceInfo.platform}</span>
          </div>
        {/if}
        
        <!-- Response Count -->
        {#if ticket.responseCount > 0}
          <div class="flex items-center space-x-1">
            <MessageSquare class="w-3 h-3" />
            <span>{ticket.responseCount} responses</span>
          </div>
        {/if}
        
        <!-- Created Date -->
        <div class="flex items-center space-x-1">
          <Clock class="w-3 h-3" />
          <span>{formatDate(ticket.createdAt)}</span>
        </div>
      </div>
    </div>

    <!-- Status and Actions -->
    <div class="flex items-center space-x-3 ml-4">
      <!-- Status Badge -->
      <div class="relative">
        <button
          type="button"
          class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium {status.color} {status.bg} hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
          on:click|stopPropagation={() => showStatusMenu = !showStatusMenu}
          disabled={updating}
        >
          <svelte:component this={status.icon} class="w-3 h-3 mr-1" />
          {status.label}
        </button>

        <!-- Status Menu -->
        {#if showStatusMenu}
          <div class="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-stone-200 z-10">
            <div class="py-1">
              {#each Object.entries(statusConfig) as [statusKey, config]}
                <button
                  type="button"
                  class="flex items-center w-full px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 {ticket.status === statusKey ? 'bg-stone-50' : ''}"
                  on:click|stopPropagation={() => updateStatus(statusKey)}
                  disabled={updating || ticket.status === statusKey}
                >
                  <svelte:component this={config.icon} class="w-4 h-4 mr-2 {config.color}" />
                  {config.label}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Urgency Indicator -->
      {#if ticket.priority === 'URGENT'}
        <AlertTriangle class="w-4 h-4 text-red-500" />
      {/if}
    </div>
  </div>
</div>

<!-- Click outside to close status menu -->
{#if showStatusMenu}
  <button
    type="button"
    class="fixed inset-0 z-0"
    on:click={() => showStatusMenu = false}
    aria-label="Close status menu"
  ></button>
{/if}

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>