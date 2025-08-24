<script lang="ts">
  import type { AdminTicketStats } from '$lib/types';
  import { MessageSquare, Clock, CheckCircle2, XCircle, AlertTriangle, BarChart } from 'lucide-svelte';
  import MetricCard from '../MetricCard.svelte';

  export let stats: AdminTicketStats;
  export let loading: boolean = false;

  $: responseTimeDisplay = stats.avgResponseTime 
    ? `${Math.round(stats.avgResponseTime)}h avg`
    : 'No data';
</script>

<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <!-- Total Tickets -->
  <MetricCard
    title="Total Tickets"
    value={stats.total}
    icon={MessageSquare}
    iconColor="text-blue-500"
    subtitle="All time"
    {loading}
  />

  <!-- Open Tickets -->
  <MetricCard
    title="Open Tickets"
    value={stats.open}
    icon={Clock}
    iconColor="text-orange-500"
    subtitle="Awaiting response"
    {loading}
  />

  <!-- In Progress -->
  <MetricCard
    title="In Progress"
    value={stats.inProgress}
    icon={BarChart}
    iconColor="text-blue-500"
    subtitle="Being worked on"
    {loading}
  />

  <!-- Resolved -->
  <MetricCard
    title="Resolved"
    value={stats.resolved}
    icon={CheckCircle2}
    iconColor="text-green-500"
    subtitle="Completed"
    {loading}
  />

  <!-- Urgent Tickets -->
  <MetricCard
    title="Urgent Tickets"
    value={stats.urgentCount}
    icon={AlertTriangle}
    iconColor="text-red-500"
    subtitle="High priority"
    {loading}
  />

  <!-- Average Response Time -->
  <MetricCard
    title="Response Time"
    value={responseTimeDisplay}
    icon={Clock}
    iconColor="text-purple-500"
    subtitle="Average first response"
    {loading}
  />
</div>