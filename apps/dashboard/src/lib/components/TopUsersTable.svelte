<script lang="ts">
  import type { TopUser } from '$lib/types';
  import { UserCheck, User } from 'lucide-svelte';

  export let users: TopUser[] = [];
  export let loading: boolean = false;
</script>

<div class="bg-white rounded-lg shadow-sm border p-6">
  <h3 class="text-lg font-semibold text-gray-900 mb-4">Top Users by Engagement</h3>
  
  {#if loading}
    <div class="animate-pulse space-y-4">
      {#each Array(5) as _}
        <div class="flex items-center space-x-3">
          <div class="w-8 h-8 bg-gray-200 rounded-full"></div>
          <div class="flex-1">
            <div class="h-4 bg-gray-200 rounded w-24 mb-2"></div>
            <div class="h-3 bg-gray-200 rounded w-16"></div>
          </div>
          <div class="text-right">
            <div class="h-4 bg-gray-200 rounded w-12 mb-1"></div>
            <div class="h-3 bg-gray-200 rounded w-8"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if users.length === 0}
    <div class="text-center text-gray-500 py-8">
      No user data available
    </div>
  {:else}
    <div class="space-y-4">
      {#each users as user, index}
        <div class="flex items-center justify-between py-2 {index !== users.length - 1 ? 'border-b border-gray-100' : ''}">
          <div class="flex items-center space-x-3">
            <div class="flex-shrink-0">
              {#if user.profileImage}
                <img
                  src={user.profileImage}
                  alt={user.username}
                  class="w-8 h-8 rounded-full object-cover"
                />
              {:else}
                <div class="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <User class="w-4 h-4 text-gray-600" />
                </div>
              {/if}
            </div>
            
            <div class="min-w-0 flex-1">
              <div class="flex items-center">
                <p class="text-sm font-medium text-gray-900 truncate">
                  @{user.username}
                </p>
                {#if user.verifiedType === 'verified'}
                  <UserCheck class="w-4 h-4 text-blue-500 ml-1 flex-shrink-0" />
                {/if}
              </div>
              <div class="text-xs text-gray-500">
                {user.postCount} posts
              </div>
            </div>
          </div>
          
          <div class="text-right">
            <div class="text-sm font-medium text-gray-900">
              {user.totalSaves + user.totalComments}
            </div>
            <div class="text-xs text-gray-500">
              {user.totalSaves} saves • {user.totalComments} comments
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>