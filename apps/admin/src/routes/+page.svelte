<script lang="ts">
  import { onMount } from "svelte";
  import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
  import { Button } from "$lib/components/ui/button";
  import CheckCircle from "lucide-svelte/icons/check-circle";
  import XCircle from "lucide-svelte/icons/x-circle";
  import RefreshCw from "lucide-svelte/icons/refresh-cw";
  import Clock from "lucide-svelte/icons/clock";

  type HealthStatus = "loading" | "healthy" | "error";
  type HealthCheckResult = {
    status: "healthy" | "error";
    message: string;
    responseTime?: string;
    timestamp: string;
  };

  let dbStatus: HealthStatus = "loading";
  let healthResult: HealthCheckResult | null = null;
  let lastChecked: string = "";
  let isChecking = false;

  async function checkDatabaseHealth() {
    dbStatus = "loading";
    isChecking = true;

    try {
      const response = await fetch("/api/health");
      healthResult = await response.json();

      dbStatus = healthResult.status;
      lastChecked = new Date().toLocaleTimeString();
    } catch (error) {
      console.error("Failed to check database health:", error);
      dbStatus = "error";
      healthResult = {
        status: "error",
        message: "Failed to connect to health check API",
        timestamp: new Date().toISOString(),
      };
    } finally {
      isChecking = false;
    }
  }

  onMount(() => {
    checkDatabaseHealth();
  });
</script>

<div class="container mx-auto p-6">
  <h1 class="text-3xl font-bold mb-8">Capture Admin Dashboard</h1>

  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
    <!-- Database Health Card -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center justify-between">
          Database Status
          <Button variant="outline" size="icon" on:click={checkDatabaseHealth} disabled={isChecking}>
            <RefreshCw class={isChecking ? "animate-spin" : ""} size={18} />
          </Button>
        </CardTitle>
        <CardDescription>D1 Database Connection Status</CardDescription>
      </CardHeader>
      <CardContent>
        {#if dbStatus === "loading"}
          <div class="flex items-center space-x-2">
            <RefreshCw class="animate-spin" />
            <span>Checking database connection...</span>
          </div>
        {:else if dbStatus === "healthy"}
          <Alert variant="default" class="bg-green-50 border-green-200">
            <CheckCircle class="h-5 w-5 text-green-500" />
            <AlertTitle>Connected</AlertTitle>
            <AlertDescription>
              {healthResult?.message}
              {#if healthResult?.responseTime}
                <div class="mt-2 flex items-center text-sm text-gray-500">
                  <Clock class="mr-1 h-4 w-4" />
                  Response time: {healthResult.responseTime}
                </div>
              {/if}
            </AlertDescription>
          </Alert>
        {:else}
          <Alert variant="destructive">
            <XCircle class="h-5 w-5" />
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription>
              {healthResult?.message || "Could not connect to database"}
            </AlertDescription>
          </Alert>
        {/if}
      </CardContent>
      <CardFooter class="text-xs text-gray-500">
        {#if lastChecked}
          Last checked: {lastChecked}
        {/if}
      </CardFooter>
    </Card>

    <!-- Add more dashboard cards here in the future -->
  </div>
</div>
