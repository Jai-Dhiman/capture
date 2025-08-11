<script>
  import { page } from '$app/stores';  
  import { Server, BarChart3, Home } from 'lucide-svelte';

  $: currentPath = $page.url.pathname;
</script>

<svelte:head>
  <style>
    /* Tailwind Base Reset */
    *, ::before, ::after { box-sizing: border-box; border-width: 0; border-style: solid; border-color: #e5e7eb; }
    body { margin: 0; line-height: inherit; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif; }
    
    /* Essential Tailwind Utilities */
    .flex { display: flex; }
    .min-h-screen { min-height: 100vh; }
    .items-center { align-items: center; }
    .justify-between { justify-content: space-between; }
    .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
    .font-bold { font-weight: 700; }
    .rounded-xl { border-radius: 0.75rem; }
    .border { border-width: 1px; }
    .border-b { border-bottom-width: 1px; }
    .shadow { box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1); }
    .shadow-sm { box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }
    .p-6 { padding: 1.5rem; }
    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
    .space-x-8 > :not([hidden]) ~ :not([hidden]) { margin-left: 2rem; }
    .h-16 { height: 4rem; }
    .w-4 { width: 1rem; }
    .h-4 { height: 1rem; }
    .mr-2 { margin-right: 0.5rem; }
    .inline-flex { display: inline-flex; }
    .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
    .font-medium { font-weight: 500; }
    .rounded-md { border-radius: 0.375rem; }
    .max-w-7xl { max-width: 80rem; }
    .mx-auto { margin-left: auto; margin-right: auto; }
    .container { width: 100%; }
    .space-y-6 > :not([hidden]) ~ :not([hidden]) { margin-top: 1.5rem; }
    .grid { display: grid; }
    .gap-4 { gap: 1rem; }
    .gap-6 { gap: 1.5rem; }
    .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
    .tracking-tight { letter-spacing: -0.025em; }
    
    /* Colors */
    .bg-stone-50 { background-color: rgb(250 250 249); }
    .bg-white { background-color: rgb(255 255 255); }
    .bg-blue-500 { background-color: rgb(59 130 246); }
    .bg-blue-50 { background-color: rgb(239 246 255); }
    .bg-stone-100 { background-color: rgb(245 245 244); }
    .text-stone-900 { color: rgb(28 25 23); }
    .text-stone-600 { color: rgb(87 83 78); }
    .text-stone-500 { color: rgb(120 113 108); }
    .text-stone-700 { color: rgb(68 64 60); }
    .text-blue-600 { color: rgb(37 99 235); }
    .text-yellow-300 { color: rgb(253 224 71); }
    .border-stone-200 { border-color: rgb(231 229 228); }
    .border-green-400 { border-color: rgb(74 222 128); }
    .bg-purple-200 { background-color: rgb(221 214 254); }
    .text-green-800 { color: rgb(22 101 52); }
    .border-orange-500 { border-color: rgb(249 115 22); }
    .shadow-lg { box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1); }
    .hover\\:text-stone-700:hover { color: rgb(68 64 60); }
    .hover\\:bg-stone-100:hover { background-color: rgb(245 245 244); }
    
    /* Additional colors for health status and error states */
    .text-green-500 { color: rgb(34 197 94); }
    .text-red-500 { color: rgb(239 68 68); }
    .text-red-700 { color: rgb(185 28 28); }
    .bg-red-50 { background-color: rgb(254 242 242); }
    .border-red-200 { border-color: rgb(254 202 202); }
    .w-5 { width: 1.25rem; }
    .h-5 { height: 1.25rem; }
    .w-3 { width: 0.75rem; }
    .h-3 { height: 0.75rem; }
    .gap-2 { gap: 0.5rem; }
    .gap-3 { gap: 0.75rem; }
    .text-right { text-align: right; }
    .opacity-90 { opacity: 0.9; }
    .mt-2 { margin-top: 0.5rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-4 { margin-bottom: 1rem; }
    .pt-4 { padding-top: 1rem; }
    .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    .animate-spin { animation: spin 1s linear infinite; }
    
    /* Animation keyframes */
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: .5; }
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    /* Grid column spans */
    .lg\\:col-span-1 { grid-column: span 1 / span 1; }
    .lg\\:col-span-2 { grid-column: span 2 / span 2; }
    
    /* Additional sizing classes */
    .text-xs { font-size: 0.75rem; line-height: 1rem; }
    .w-4 { width: 1rem; }
    .h-4 { height: 1rem; }
    .mb-3 { margin-bottom: 0.75rem; }
    .pt-3 { padding-top: 0.75rem; }
    .space-y-2 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.5rem; }
    .space-y-3 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.75rem; }
    .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
    
    /* Grid responsive - Fixed */
    .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
    
    @media (min-width: 768px) {
      .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
      .md\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
    }
    @media (min-width: 1024px) {
      .lg\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
      .lg\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
      .lg\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
      .lg\\:px-8 { padding-left: 2rem; padding-right: 2rem; }
    }
    @media (min-width: 640px) {
      .sm\\:px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
    }
  </style>
</svelte:head>

<div class="min-h-screen bg-stone-50">
  <!-- Navigation -->
  <nav class="bg-white shadow-sm border-b border-stone-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex items-center">
          <h1 class="text-xl font-bold text-stone-900">Capture Dashboard</h1>
        </div>
        
        <div class="flex items-center">
          <span class="inline-flex items-center px-3 py-2 text-sm font-medium text-stone-600">
            <BarChart3 class="w-4 h-4 mr-2" />
            Analytics Dashboard
          </span>
        </div>
      </div>
    </div>
  </nav>

  <!-- Main Content -->
  <main>
    <slot />
  </main>
</div> 