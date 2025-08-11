<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import type { UserGrowthData } from '$lib/types';

	export let data: UserGrowthData | null = null;
	export let isLoading: boolean = false;

	$: maxValue = data ? Math.max(...data.data.map(d => d.count)) : 0;
	$: minValue = data ? Math.min(...data.data.map(d => d.count)) : 0;

	function getPointX(index: number, total: number): number {
		if (total <= 1) return 10;
		return 10 + (index / (total - 1)) * 80;
	}

	function getPointY(value: number): number {
		if (maxValue === minValue) return 50;
		return 85 - ((value - minValue) / (maxValue - minValue)) * 70;
	}

	function createPath(points: Array<{date: string, count: number}>): string {
		if (!points.length) return '';
		
		const pathData = points.map((point, index) => {
			const x = getPointX(index, points.length);
			const y = getPointY(point.count);
			return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
		}).join(' ');

		return pathData;
	}

	function createAreaPath(points: Array<{date: string, count: number}>): string {
		if (!points.length) return '';
		
		const linePath = createPath(points);
		if (!linePath) return '';

		const firstX = getPointX(0, points.length);
		const lastX = getPointX(points.length - 1, points.length);
		
		return `${linePath} L ${lastX} 85 L ${firstX} 85 Z`;
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>User Growth</Card.Title>
		<Card.Description>New user signups over the last {data?.period || '30 days'}</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if isLoading}
			<div class="h-[200px] bg-muted rounded animate-pulse"></div>
		{:else if data && data.data.length > 0}
			<div class="h-[200px] w-full">
				<svg viewBox="0 0 100 100" class="w-full h-full">
					<!-- Grid lines -->
					{#each [25, 50, 75] as y}
						<line
							x1="10"
							y1={y}
							x2="90"
							y2={y}
							stroke="currentColor"
							stroke-width="0.1"
							opacity="0.2"
						/>
					{/each}

					<!-- Area fill -->
					<path
						d={createAreaPath(data.data)}
						fill="hsl(var(--primary))"
						opacity="0.1"
					/>

					<!-- Line -->
					<path
						d={createPath(data.data)}
						fill="none"
						stroke="hsl(var(--primary))"
						stroke-width="0.5"
					/>

					<!-- Points -->
					{#each data.data as point, index}
						<circle
							cx={getPointX(index, data.data.length)}
							cy={getPointY(point.count)}
							r="0.5"
							fill="hsl(var(--primary))"
						/>
					{/each}

					<!-- Y-axis labels -->
					<text x="2" y="85" class="text-xs fill-muted-foreground" dominant-baseline="middle">
						{minValue}
					</text>
					<text x="2" y="15" class="text-xs fill-muted-foreground" dominant-baseline="middle">
						{maxValue}
					</text>
				</svg>
			</div>

			<div class="mt-4 flex justify-between text-xs text-muted-foreground">
				{#if data.data.length > 0}
					<span>{new Date(data.data[0].date).toLocaleDateString()}</span>
					<span>{new Date(data.data[data.data.length - 1].date).toLocaleDateString()}</span>
				{/if}
			</div>
		{:else}
			<div class="h-[200px] flex items-center justify-center text-muted-foreground">
				No growth data available
			</div>
		{/if}
	</Card.Content>
</Card.Root>