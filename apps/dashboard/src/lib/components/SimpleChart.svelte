<script lang="ts">
  export let title: string;
  export let data: Array<{ date: string; count: number }> = [];
  export let color: string = '#3b82f6';
  export let loading: boolean = false;

  // Simple SVG line chart implementation
  function createPath(points: Array<{ x: number; y: number }>): string {
    if (points.length === 0) return '';
    
    const path = points.reduce((acc, point, index) => {
      const command = index === 0 ? 'M' : 'L';
      return `${acc} ${command} ${point.x} ${point.y}`;
    }, '');
    
    return path;
  }

  $: chartData = data.length > 0 ? (() => {
    const maxValue = Math.max(...data.map(d => d.count), 1);
    const width = 300;
    const height = 120;
    const padding = 10;
    
    return data.map((item, index) => ({
      x: padding + (index * (width - 2 * padding)) / (data.length - 1),
      y: height - padding - ((item.count / maxValue) * (height - 2 * padding)),
      value: item.count,
      date: item.date,
    }));
  })() : [];

  $: pathData = createPath(chartData);
</script>

<div class="bg-white rounded-lg shadow-sm border p-6">
  <h3 class="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
  
  {#if loading}
    <div class="animate-pulse">
      <div class="h-32 bg-gray-200 rounded"></div>
    </div>
  {:else if data.length === 0}
    <div class="h-32 flex items-center justify-center text-gray-500">
      No data available
    </div>
  {:else}
    <div class="h-32 overflow-hidden">
      <svg width="300" height="120" class="w-full h-full">
        <!-- Grid lines -->
        <defs>
          <pattern id="grid" width="30" height="24" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 24" fill="none" stroke="#f3f4f6" stroke-width="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        <!-- Data line -->
        {#if pathData}
          <path
            d={pathData}
            fill="none"
            stroke={color}
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        {/if}
        
        <!-- Data points -->
        {#each chartData as point}
          <circle
            cx={point.x}
            cy={point.y}
            r="3"
            fill={color}
            class="hover:r-4 transition-all duration-200"
          >
            <title>{point.date}: {point.value}</title>
          </circle>
        {/each}
      </svg>
    </div>
    
    <!-- Chart legend/info -->
    {#if data.length > 0}
      <div class="mt-4 flex justify-between text-xs text-gray-500">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    {/if}
  {/if}
</div>