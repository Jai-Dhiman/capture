<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { TrendingUp, TrendingDown, Minus } from 'lucide-svelte';

	export let title: string;
	export let value: string | number;
	export let description: string = '';
	export let trend: number | null = null;
	export let icon: any = null;
	export let isLoading: boolean = false;

	$: trendIcon = trend 
		? trend > 0 ? TrendingUp 
		: trend < 0 ? TrendingDown 
		: Minus
		: null;

	$: trendColor = trend 
		? trend > 0 ? 'text-green-600' 
		: trend < 0 ? 'text-red-600' 
		: 'text-gray-400'
		: 'text-gray-400';

	$: badgeVariant = trend 
		? trend > 0 ? 'default' 
		: trend < 0 ? 'destructive' 
		: 'secondary'
		: 'secondary';
</script>

<Card.Root>
	<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
		<Card.Title class="text-sm font-medium text-stone-600">
			{title}
		</Card.Title>
		{#if icon}
			<svelte:component this={icon} class="h-4 w-4 text-stone-600" />
		{/if}
	</Card.Header>
	<Card.Content>
		{#if isLoading}
			<div class="space-y-2">
				<div class="h-8 bg-stone-200 rounded animate-pulse"></div>
				<div class="h-4 bg-stone-200 rounded w-3/4 animate-pulse"></div>
			</div>
		{:else}
			<div class="text-2xl font-bold">
				{typeof value === 'number' ? value.toLocaleString() : value}
			</div>
			{#if description || trend !== null}
				<div class="flex items-center gap-2 text-xs text-stone-600 mt-1">
					{#if trend !== null && trendIcon}
						<Badge variant={badgeVariant} class="flex items-center gap-1">
							<svelte:component this={trendIcon} class="h-3 w-3" />
							{Math.abs(trend).toFixed(1)}%
						</Badge>
					{/if}
					{#if description}
						<span>{description}</span>
					{/if}
				</div>
			{/if}
		{/if}
	</Card.Content>
</Card.Root>