<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Crown, Shield, Star } from 'lucide-svelte';
	import type { TopUsersData } from '$lib/types';

	export let data: TopUsersData | null = null;
	export let isLoading: boolean = false;

	function getVerificationIcon(verifiedType: string) {
		switch (verifiedType) {
			case 'blue':
				return Shield;
			case 'gold':
				return Crown;
			case 'verified':
				return Star;
			default:
				return null;
		}
	}

	function getVerificationColor(verifiedType: string) {
		switch (verifiedType) {
			case 'blue':
				return 'text-blue-500';
			case 'gold':
				return 'text-yellow-500';
			case 'verified':
				return 'text-green-500';
			default:
				return 'text-gray-400';
		}
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Top Users</Card.Title>
		<Card.Description>Most active users by engagement metrics</Card.Description>
	</Card.Header>
	<Card.Content class="p-0">
		{#if isLoading}
			<div class="space-y-3 p-6">
				{#each Array(5) as _}
					<div class="flex items-center space-x-4">
						<div class="w-8 h-8 bg-muted rounded-full animate-pulse"></div>
						<div class="flex-1 space-y-2">
							<div class="h-4 bg-muted rounded animate-pulse"></div>
							<div class="h-3 bg-muted rounded w-1/2 animate-pulse"></div>
						</div>
						<div class="w-16 h-4 bg-muted rounded animate-pulse"></div>
					</div>
				{/each}
			</div>
		{:else if data?.users && data.users.length > 0}
			<div class="space-y-0">
				{#each data.users as user, index}
					<div class="flex items-center justify-between p-4 {index !== data.users.length - 1 ? 'border-b' : ''}">
						<div class="flex items-center space-x-3">
							<div class="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">
								{index + 1}
							</div>
							<div class="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
								{#if user.profileImage}
									<img src={user.profileImage} alt={user.username} class="w-8 h-8 rounded-full" />
								{:else}
									<span class="text-xs font-medium">
										{user.username.charAt(0).toUpperCase()}
									</span>
								{/if}
							</div>
							<div>
								<div class="flex items-center gap-1">
									<span class="font-medium">@{user.username}</span>
									{#if user.verifiedType && user.verifiedType !== 'none'}
										{@const VerificationIcon = getVerificationIcon(user.verifiedType)}
										{#if VerificationIcon}
											<VerificationIcon class="w-3 h-3 {getVerificationColor(user.verifiedType)}" />
										{/if}
									{/if}
								</div>
								<div class="text-xs text-muted-foreground">
									{user.postCount} posts • {user.totalComments} comments
								</div>
							</div>
						</div>
						<div class="text-right">
							<div class="font-medium">{user.totalSaves}</div>
							<div class="text-xs text-muted-foreground">saves</div>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="p-6 text-center text-muted-foreground">
				No user data available
			</div>
		{/if}
	</Card.Content>
</Card.Root>