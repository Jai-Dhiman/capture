import type { Route } from "./+types/home";
import { DashboardLayout } from "../components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Dashboard - Capture" },
    { name: "description", content: "Capture Analytics Dashboard" },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  try {
    const { results } = await context.cloudflare.env.DB.prepare("SELECT 1 as ok").all();
    return { dbOk: results.length > 0 };
  } catch (error) {
    return { dbOk: false, error: (error as Error).message };
  }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <DashboardLayout>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Unique Sign Ups: 205</div>
            <p className="text-xs text-green-500 flex items-center mt-1">
              <span className="i-lucide-trending-up mr-1">↑</span>
              2.1% vs last week
            </p>
            <div className="h-[80px] mt-4 flex items-end gap-2">
              {[40, 30, 45, 25, 55, 65, 45, 40, 55, 40, 50, 70].map((height, i) => (
                <div
                  key={i}
                  className="bg-blue-500 rounded-sm w-full"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>01</span>
              <span>06</span>
              <span>12</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Content Uploaded</CardTitle>
            <CardDescription>From 1-5 Dec, 2025</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mt-4 flex items-center justify-center">
              <div className="relative h-40 w-40">
                <div className="h-40 w-40 rounded-full bg-blue-50" />
                <div className="absolute inset-[15%] rounded-full bg-background flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold">1,850</span>
                  <span className="text-sm text-muted-foreground">Total</span>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-blue-500" />
                <span>Post</span>
                <span className="ml-auto">40%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-indigo-400" />
                <span>Thread</span>
                <span className="ml-auto">32%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-cyan-300" />
                <span>Capture</span>
                <span className="ml-auto">28%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Posts Saved per Day</CardTitle>
            <CardDescription>
              <span className="text-red-500 text-xs">2.1% vs last week</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2,568</div>
            <div className="h-[120px] mt-4">
              {/* Placeholder for line chart */}
              <div className="w-full h-full bg-gradient-to-r from-blue-100 to-blue-500 opacity-20 rounded-md" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile Type</CardTitle>
            <CardDescription>Business, Public, Private</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-500 text-white">
                85%
              </div>
              <span className="text-sm font-medium">Public</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-orange-400 text-white">
                10%
              </div>
              <span className="text-sm font-medium">Business</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-cyan-400 text-white">
                92%
              </div>
              <span className="text-sm font-medium">Private</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Average Comment Length</CardTitle>
            <CardDescription>Sorted by Profile Type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center">
                  <span className="text-sm font-medium">Public Profiles</span>
                  <span className="ml-auto text-sm">50 Characters</span>
                </div>
                <Progress value={25} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center">
                  <span className="text-sm font-medium">Private Profiles</span>
                  <span className="ml-auto text-sm">5 Characters</span>
                </div>
                <Progress value={5} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center">
                  <span className="text-sm font-medium">Business Profiles</span>
                  <span className="ml-auto text-sm">217 Characters</span>
                </div>
                <Progress value={70} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center">
                  <span className="text-sm font-medium">News Outlets</span>
                  <span className="ml-auto text-sm">500 Characters</span>
                </div>
                <Progress value={100} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
