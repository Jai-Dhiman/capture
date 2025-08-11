<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import type { ContentActivityData } from '$lib/types';

	export let data: ContentActivityData | null = null;
	export let isLoading: boolean = false;

	$: chartData = data ? [...data.posts, ...data.comments] : [];
	$: maxValue = chartData.length > 0 ? Math.max(...chartData.map(d => d.count)) : 0;

	function getPointX(index: number, total: number): number {
		if (total <= 1) return 50;
		return (index / (total - 1)) * 100;
	}

	function getPointY(value: number): number {
		if (maxValue === 0) return 50;
		return 90 - (value / maxValue) * 80;
	}

	function createPath(points: Array<{date: string, count: number}>, color: string): string {
		if (!points.length) return '';
		
		const pathData = points.map((point, index) => {
			const x = getPointX(index, points.length);
			const y = getPointY(point.count);
			return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
		}).join(' ');

		return pathData;
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Activity Trends</Card.Title>
		<Card.Description>Posts and comments over the last {data?.period || '30 days'}</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if isLoading}
			<div class="h-[200px] bg-muted rounded animate-pulse"></div>
		{:else if data}
			<div class="h-[200px] w-full">
				<svg viewBox="0 0 100 100" class="w-full h-full">
					<!-- Grid lines -->
					{#each [20, 40, 60, 80] as y}
						<line
							x1="0"
							y1={y}
							x2="100"
							y2={y}
							stroke="currentColor"
							stroke-width="0.1"
							opacity="0.1"
						/>
					{/each}

					<!-- Posts line -->
					{#if data.posts.length > 0}
						<path
							d={createPath(data.posts, 'hsl(var(--primary))')}
							fill="none"
							stroke="hsl(var(--primary))"
							stroke-width="0.5"
							opacity="0.8"
						/>
						{#each data.posts as point, index}
							<circle
								cx={getPointX(index, data.posts.length)}
								cy={getPointY(point.count)}
								r="0.5"
								fill="hsl(var(--primary))"
							/>
						{/each}
					{/if}

					<!-- Comments line -->
					{#if data.comments.length > 0}
						<path
							d={createPath(data.comments, 'hsl(var(--secondary))')}
							fill="none"
							stroke="hsl(var(--muted-foreground))"
							stroke-width="0.5"
							opacity="0.8"
							stroke-dasharray="1,1"
						/>
						{#each data.comments as point, index}
							<circle
								cx={getPointX(index, data.comments.length)}
								cy={getPointY(point.count)}
								r="0.5"
								fill="hsl(var(--muted-foreground))"
							/>
						{/each}
					{/if}
				</svg>
			</div>

			<div class="flex items-center gap-4 mt-4">
				<div class="flex items-center gap-2">
					<div class="w-3 h-3 bg-primary rounded-full"></div>
					<span class="text-sm text-muted-foreground">Posts</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="w-3 h-3 bg-muted-foreground rounded-full"></div>
					<span class="text-sm text-muted-foreground">Comments</span>
				</div>
			</div>
		{:else}
			<div class="h-[200px] flex items-center justify-center text-muted-foreground">
				No activity data available
			</div>
		{/if}
	</Card.Content>
</Card.Root>