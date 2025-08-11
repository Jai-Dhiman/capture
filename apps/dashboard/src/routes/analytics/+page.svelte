<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/api';
	import { Button } from '$lib/components/ui/button';
	import MetricCard from '$lib/components/analytics/MetricCard.svelte';
	import ActivityChart from '$lib/components/analytics/ActivityChart.svelte';
	import GrowthChart from '$lib/components/analytics/GrowthChart.svelte';
	import TopUsersTable from '$lib/components/analytics/TopUsersTable.svelte';
	import {
		Users,
		FileText,
		MessageSquare,
		Heart,
		Bookmark,
		UserCheck,
		TrendingUp,
		RefreshCw,
		Calendar
	} from 'lucide-svelte';
	import type {
		AnalyticsOverview,
		UserGrowthData,
		ContentActivityData,
		TopUsersData,
		RecentActivityData
	} from '$lib/types';

	let overview: AnalyticsOverview | null = null;
	let userGrowth: UserGrowthData | null = null;
	let contentActivity: ContentActivityData | null = null;
	let topUsers: TopUsersData | null = null;
	let recentActivity: RecentActivityData | null = null;

	let isLoading = true;
	let error: string | null = null;
	let lastUpdated: Date | null = null;

	async function loadAnalytics() {
		try {
			isLoading = true;
			error = null;

			const [overviewRes, userGrowthRes, contentActivityRes, topUsersRes, recentActivityRes] = await Promise.all([
				api.analytics.overview(),
				api.analytics.userGrowth(),
				api.analytics.contentActivity(),
				api.analytics.topUsers(),
				api.analytics.recentActivity()
			]);

			overview = overviewRes;
			userGrowth = userGrowthRes;
			contentActivity = contentActivityRes;
			topUsers = topUsersRes;
			recentActivity = recentActivityRes;
			lastUpdated = new Date();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load analytics data';
			console.error('Analytics loading error:', err);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		loadAnalytics();
		
		// Auto-refresh every 5 minutes
		const interval = setInterval(loadAnalytics, 5 * 60 * 1000);
		return () => clearInterval(interval);
	});
</script>

<svelte:head>
	<title>Analytics - Capture Dashboard</title>
</svelte:head>

<div class="container mx-auto p-6 space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Analytics</h1>
			<p class="text-stone-600">
				Platform insights and performance metrics
			</p>
		</div>
		<div class="flex items-center gap-2">
			{#if lastUpdated}
				<div class="flex items-center gap-1 text-xs text-stone-600">
					<Calendar class="w-3 h-3" />
					Updated {lastUpdated.toLocaleTimeString()}
				</div>
			{/if}
			<Button 
				variant="outline" 
				size="sm" 
				on:click={loadAnalytics} 
				disabled={isLoading}
			>
				<RefreshCw class="w-4 h-4 {isLoading ? 'animate-spin' : ''}" />
				Refresh
			</Button>
		</div>
	</div>

	{#if error}
		<div class="bg-destructive/15 border border-destructive/50 text-destructive px-4 py-3 rounded-lg">
			<p class="font-medium">Failed to load analytics</p>
			<p class="text-sm opacity-90">{error}</p>
			<Button variant="outline" size="sm" class="mt-2" on:click={loadAnalytics}>
				Try Again
			</Button>
		</div>
	{/if}

	<!-- Overview Metrics -->
	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
		<MetricCard
			title="Total Users"
			value={overview?.users.total ?? 0}
			description="platform users"
			trend={overview?.users.weeklyGrowth ?? null}
			icon={Users}
			{isLoading}
		/>
		<MetricCard
			title="Verified Users"
			value={overview?.users.verified ?? 0}
			description={overview?.users.verificationRate ?? "0%"}
			icon={UserCheck}
			{isLoading}
		/>
		<MetricCard
			title="Total Posts"
			value={overview?.content.posts.total ?? 0}
			description="content items"
			trend={overview?.content.posts.weeklyNew ? 
				((overview.content.posts.weeklyNew / overview.content.posts.total) * 100) : null}
			icon={FileText}
			{isLoading}
		/>
		<MetricCard
			title="Total Comments"
			value={overview?.content.comments.total ?? 0}
			description={overview?.content.comments.averagePerPost ?? "0 per post"}
			icon={MessageSquare}
			{isLoading}
		/>
	</div>

	<!-- Engagement Metrics -->
	<div class="grid gap-4 md:grid-cols-3">
		<MetricCard
			title="Total Saves"
			value={overview?.engagement.totalSaves ?? 0}
			description={overview?.engagement.savesPerPost ?? "0 per post"}
			icon={Bookmark}
			{isLoading}
		/>
		<MetricCard
			title="Total Likes"
			value={(overview?.engagement.totalPostLikes ?? 0) + (overview?.engagement.totalCommentLikes ?? 0)}
			description="posts + comments"
			icon={Heart}
			{isLoading}
		/>
		<MetricCard
			title="Engagement Rate"
			value={overview?.engagement.engagementRate ?? "0%"}
			description="overall platform engagement"
			icon={TrendingUp}
			{isLoading}
		/>
	</div>

	<!-- Charts Row -->
	<div class="grid gap-6 lg:grid-cols-2">
		<GrowthChart data={userGrowth} {isLoading} />
		<ActivityChart data={contentActivity} {isLoading} />
	</div>

	<!-- Bottom Row -->
	<div class="grid gap-6 lg:grid-cols-3">
		<!-- Recent Activity -->
		<div class="lg:col-span-1">
			{#if isLoading}
				<div class="bg-card border rounded-lg p-6">
					<div class="space-y-3">
						<div class="h-5 bg-muted rounded animate-pulse"></div>
						<div class="h-4 bg-muted rounded w-2/3 animate-pulse"></div>
						<div class="space-y-2 pt-4">
							{#each Array(4) as _}
								<div class="flex justify-between">
									<div class="h-4 bg-muted rounded w-1/3 animate-pulse"></div>
									<div class="h-4 bg-muted rounded w-1/4 animate-pulse"></div>
								</div>
							{/each}
						</div>
					</div>
				</div>
			{:else if recentActivity}
				<div class="bg-card border rounded-lg p-6">
					<h3 class="font-semibold mb-2">Recent Activity</h3>
					<p class="text-sm text-muted-foreground mb-4">Last {recentActivity.period}</p>
					<div class="space-y-3">
						<div class="flex justify-between items-center">
							<span class="text-sm">New Posts</span>
							<span class="font-medium">{recentActivity.activity.posts}</span>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-sm">New Comments</span>
							<span class="font-medium">{recentActivity.activity.comments}</span>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-sm">Likes</span>
							<span class="font-medium">{recentActivity.activity.likes}</span>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-sm">New Follows</span>
							<span class="font-medium">{recentActivity.activity.follows}</span>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Top Users -->
		<div class="lg:col-span-2">
			<TopUsersTable data={topUsers} {isLoading} />
		</div>
	</div>
</div>