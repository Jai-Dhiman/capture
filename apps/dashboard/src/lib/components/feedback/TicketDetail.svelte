<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { FeedbackTicket } from '$lib/types';
  import { api } from '$lib/api';
  import { 
    X, 
    User, 
    Clock, 
    MessageSquare, 
    Paperclip,
    Send,
    Eye,
    EyeOff,
    Smartphone,
    Monitor,
    Tablet,
    Bug,
    Lightbulb,
    HelpCircle,
    MessageCircle
  } from 'lucide-svelte';

  export let ticket: FeedbackTicket;

  const dispatch = createEventDispatcher<{
    close: void;
    update: void;
  }>();

  let responseMessage = '';
  let isInternalResponse = false;
  let submitting = false;
  let detailedTicket: FeedbackTicket | null = null;
  let loading = true;

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
    return new Date(dateString).toLocaleString();
  }

  async function loadTicketDetails() {
    try {
      loading = true;
      const response = await api.feedback.getTicket(ticket.id);
      detailedTicket = response.ticket;
    } catch (error) {
      console.error('Failed to load ticket details:', error);
    } finally {
      loading = false;
    }
  }

  async function submitResponse() {
    if (!responseMessage.trim() || submitting) return;
    
    try {
      submitting = true;
      await api.feedback.addAdminResponse(ticket.id, responseMessage.trim(), isInternalResponse);
      responseMessage = '';
      isInternalResponse = false;
      dispatch('update');
      await loadTicketDetails(); // Refresh the details
    } catch (error) {
      console.error('Failed to submit response:', error);
      // TODO: Show error toast
    } finally {
      submitting = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      dispatch('close');
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submitResponse();
    }
  }

  $: displayTicket = detailedTicket || ticket;
  $: type = typeConfig[displayTicket.type] ?? typeConfig.FEEDBACK;
  $: DeviceIcon = getDeviceIcon(displayTicket.deviceInfo?.platform);
  // Load detailed ticket data when component mounts
  loadTicketDetails();
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- Modal Backdrop -->
<div class="fixed inset-0 bg-stone-900 bg-opacity-50 flex items-center justify-center p-4 z-50">
  <!-- Modal -->
  <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
    <!-- Header -->
    <div class="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <svelte:component this={type.icon} class="w-6 h-6 {type.color}" />
        <div>
          <h2 class="text-xl font-semibold text-stone-900">
            {displayTicket.subject}
          </h2>
          <p class="text-sm text-stone-600">
            Ticket #{displayTicket.id.slice(-8)}
          </p>
        </div>
      </div>
      
      <button
        type="button"
        class="text-stone-400 hover:text-stone-600"
        on:click={() => dispatch('close')}
      >
        <X class="w-6 h-6" />
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto max-h-[calc(90vh-8rem)]">
      {#if loading}
        <div class="p-6">
          <div class="animate-pulse space-y-4">
            <div class="h-4 bg-stone-200 rounded w-3/4"></div>
            <div class="h-4 bg-stone-200 rounded w-1/2"></div>
            <div class="h-32 bg-stone-200 rounded"></div>
          </div>
        </div>
      {:else}
        <div class="p-6 space-y-6">
          <!-- Ticket Info -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Main Content -->
            <div class="lg:col-span-2">
              <h3 class="text-lg font-medium text-stone-900 mb-3">Description</h3>
              <div class="bg-stone-50 rounded-lg p-4">
                <p class="text-stone-700 whitespace-pre-wrap">{displayTicket.description}</p>
              </div>

              <!-- Device Info -->
              {#if displayTicket.deviceInfo}
                <div class="mt-6">
                  <h4 class="text-sm font-medium text-stone-900 mb-2">Device Information</h4>
                  <div class="bg-stone-50 rounded-lg p-3">
                    <div class="grid grid-cols-2 gap-3 text-sm">
                      {#if displayTicket.deviceInfo.platform}
                        <div>
                          <span class="text-stone-500">Platform:</span>
                          <span class="ml-2 text-stone-700">{displayTicket.deviceInfo.platform}</span>
                        </div>
                      {/if}
                      {#if displayTicket.deviceInfo.osVersion}
                        <div>
                          <span class="text-stone-500">OS Version:</span>
                          <span class="ml-2 text-stone-700">{displayTicket.deviceInfo.osVersion}</span>
                        </div>
                      {/if}
                      {#if displayTicket.deviceInfo.appVersion}
                        <div>
                          <span class="text-stone-500">App Version:</span>
                          <span class="ml-2 text-stone-700">{displayTicket.deviceInfo.appVersion}</span>
                        </div>
                      {/if}
                      {#if displayTicket.deviceInfo.deviceModel}
                        <div>
                          <span class="text-stone-500">Device:</span>
                          <span class="ml-2 text-stone-700">{displayTicket.deviceInfo.deviceModel}</span>
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              {/if}

              <!-- Attachments -->
              {#if displayTicket.attachments && displayTicket.attachments.length > 0}
                <div class="mt-6">
                  <h4 class="text-sm font-medium text-stone-900 mb-2">Attachments</h4>
                  <div class="space-y-2">
                    {#each displayTicket.attachments as attachment}
                      <div class="flex items-center space-x-3 p-2 bg-stone-50 rounded-lg">
                        <Paperclip class="w-4 h-4 text-stone-500" />
                        <span class="text-sm text-stone-700">{attachment.description || 'Attachment'}</span>
                        <span class="text-xs text-stone-500">by @{attachment.uploadedBy.username}</span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>

            <!-- Sidebar -->
            <div class="space-y-4">
              <!-- User Info -->
              <div class="bg-stone-50 rounded-lg p-4">
                <h4 class="text-sm font-medium text-stone-900 mb-3">Reporter</h4>
                <div class="flex items-center space-x-3">
                  <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <User class="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p class="text-sm font-medium text-stone-900">@{displayTicket.user.username}</p>
                    <p class="text-xs text-stone-500">{displayTicket.user.verifiedType}</p>
                  </div>
                </div>
              </div>

              <!-- Ticket Meta -->
              <div class="bg-stone-50 rounded-lg p-4">
                <h4 class="text-sm font-medium text-stone-900 mb-3">Details</h4>
                <div class="space-y-2 text-sm">
                  <div>
                    <span class="text-stone-500">Status:</span>
                    <span class="ml-2 text-stone-700">{displayTicket.status.replace('_', ' ')}</span>
                  </div>
                  <div>
                    <span class="text-stone-500">Priority:</span>
                    <span class="ml-2 text-stone-700">{displayTicket.priority}</span>
                  </div>
                  <div>
                    <span class="text-stone-500">Type:</span>
                    <span class="ml-2 text-stone-700">{type.label}</span>
                  </div>
                  <div>
                    <span class="text-stone-500">Category:</span>
                    <span class="ml-2 text-stone-700">{displayTicket.category.name}</span>
                  </div>
                  <div>
                    <span class="text-stone-500">Created:</span>
                    <span class="ml-2 text-stone-700">{formatDate(displayTicket.createdAt)}</span>
                  </div>
                  {#if displayTicket.resolvedAt}
                    <div>
                      <span class="text-stone-500">Resolved:</span>
                      <span class="ml-2 text-stone-700">{formatDate(displayTicket.resolvedAt)}</span>
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          </div>

          <!-- Responses/Conversation -->
          <div>
            <h3 class="text-lg font-medium text-stone-900 mb-4">
              Conversation ({displayTicket.responseCount || 0})
            </h3>
            
            {#if displayTicket.responses && displayTicket.responses.length > 0}
              <div class="space-y-4">
                {#each displayTicket.responses as response}
                  <div class="border border-stone-200 rounded-lg p-4 {response.isInternal ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}">
                    <div class="flex items-start justify-between mb-2">
                      <div class="flex items-center space-x-3">
                        <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                          <User class="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p class="text-sm font-medium text-stone-900">
                            @{response.responder.username}
                            <span class="ml-2 px-2 py-1 text-xs rounded-full {response.responderType === 'ADMIN' ? 'bg-blue-100 text-blue-700' : 'bg-stone-100 text-stone-700'}">
                              {response.responderType.toLowerCase()}
                            </span>
                          </p>
                          <p class="text-xs text-stone-500">{formatDate(response.createdAt)}</p>
                        </div>
                      </div>
                      
                      {#if response.isInternal}
                        <div class="flex items-center text-xs text-yellow-600">
                          <EyeOff class="w-3 h-3 mr-1" />
                          Internal note
                        </div>
                      {/if}
                    </div>
                    
                    <p class="text-stone-700 whitespace-pre-wrap ml-11">{response.message}</p>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="text-stone-500 text-center py-8">No responses yet</p>
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <!-- Response Form -->
    <div class="border-t border-stone-200 p-6">
      <form on:submit|preventDefault={submitResponse}>
        <div class="space-y-4">
          <!-- Response Type Toggle -->
          <div class="flex items-center space-x-4">
            <label class="inline-flex items-center">
              <input
                type="checkbox"
                class="rounded border-stone-300 text-blue-600 focus:ring-blue-500"
                bind:checked={isInternalResponse}
              />
              <span class="ml-2 text-sm text-stone-700">Internal note (not visible to user)</span>
              {#if isInternalResponse}
                <EyeOff class="w-4 h-4 ml-1 text-yellow-500" />
              {:else}
                <Eye class="w-4 h-4 ml-1 text-blue-500" />
              {/if}
            </label>
          </div>

          <!-- Message Input -->
          <div>
            <textarea
              class="block w-full px-3 py-2 border border-stone-300 rounded-md text-sm placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows="4"
              placeholder={isInternalResponse ? "Add an internal note..." : "Type your response to the user..."}
              bind:value={responseMessage}
              disabled={submitting}
            ></textarea>
          </div>

          <!-- Submit Button -->
          <div class="flex items-center justify-between">
            <p class="text-xs text-stone-500">
              Press Cmd+Enter to send
            </p>
            
            <button
              type="submit"
              class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!responseMessage.trim() || submitting}
            >
              {#if submitting}
                <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Sending...
              {:else}
                <Send class="w-4 h-4 mr-2" />
                Send Response
              {/if}
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</div>