import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";

export function meta() {
  return [
    { title: "Interaction Breakdown - Capture" },
    { name: "description", content: "Interaction Breakdown for Capture Platform" },
  ];
}

export default function InteractionBreakdown() {
  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Interaction Breakdown</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Popular Interactions</CardTitle>
            <CardDescription>Top user interactions by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Likes</span>
                  <span className="text-sm text-muted-foreground">75%</span>
                </div>
                <Progress value={75} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Comments</span>
                  <span className="text-sm text-muted-foreground">45%</span>
                </div>
                <Progress value={45} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Shares</span>
                  <span className="text-sm text-muted-foreground">25%</span>
                </div>
                <Progress value={25} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Bookmarks</span>
                  <span className="text-sm text-muted-foreground">15%</span>
                </div>
                <Progress value={15} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Interaction by Time of Day</CardTitle>
            <CardDescription>When users are most active</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-end gap-2 pt-6">
              {[15, 25, 40, 30, 55, 85, 65, 70, 60, 75, 45, 30, 45, 60, 75, 80, 70, 60, 90, 80, 65, 40, 30, 20].map((height, i) => (
                <div
                  key={`${(i % 12) + 1}${i < 12 ? 'am' : 'pm'}`}
                  className="flex-1 bg-blue-500 rounded-sm"
                  style={{ height: `${height}%` }}
                  title={`${(i % 12) + 1}${i < 12 ? 'am' : 'pm'}: ${height}%`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-xs text-muted-foreground">12am</span>
              <span className="text-xs text-muted-foreground">6am</span>
              <span className="text-xs text-muted-foreground">12pm</span>
              <span className="text-xs text-muted-foreground">6pm</span>
              <span className="text-xs text-muted-foreground">12am</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Device Breakdown</CardTitle>
            <CardDescription>User interactions by device</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <div className="space-y-6 w-full max-w-md">
                <div className="flex items-center gap-4">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Mobile</span>
                      <span className="text-sm">78%</span>
                    </div>
                    <Progress value={78} className="h-2 mt-1" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Desktop</span>
                      <span className="text-sm">17%</span>
                    </div>
                    <Progress value={17} className="h-2 mt-1" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-3 w-3 rounded-full bg-amber-500" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Tablet</span>
                      <span className="text-sm">5%</span>
                    </div>
                    <Progress value={5} className="h-2 mt-1" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Engagement by Content Type</CardTitle>
            <CardDescription>Average engagement metrics by content format</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6">
              <div className="flex flex-col items-center border rounded-lg p-4">
                <div className="text-3xl font-bold mb-2">4.7s</div>
                <div className="text-sm text-center text-muted-foreground">Avg. View Time for Photos</div>
                <div className="mt-auto pt-4">
                  <div className="text-xs text-center text-green-500">+12% vs last month</div>
                </div>
              </div>
              <div className="flex flex-col items-center border rounded-lg p-4">
                <div className="text-3xl font-bold mb-2">23.2s</div>
                <div className="text-sm text-center text-muted-foreground">Avg. View Time for Videos</div>
                <div className="mt-auto pt-4">
                  <div className="text-xs text-center text-green-500">+28% vs last month</div>
                </div>
              </div>
              <div className="flex flex-col items-center border rounded-lg p-4">
                <div className="text-3xl font-bold mb-2">2.3</div>
                <div className="text-sm text-center text-muted-foreground">Avg. Interactions per Thread</div>
                <div className="mt-auto pt-4">
                  <div className="text-xs text-center text-red-500">-4% vs last month</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Engagement Funnel</CardTitle>
            <CardDescription>User journey through content consumption</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-4 w-full max-w-lg">
                <div className="w-full py-4 px-6 rounded-lg bg-blue-500 text-white text-center">
                  <div className="text-lg font-bold">Content Viewed</div>
                  <div className="text-2xl font-bold mt-1">89.4%</div>
                </div>
                <div className="w-[90%] py-4 px-6 rounded-lg bg-indigo-500 text-white text-center">
                  <div className="text-lg font-bold">Read Caption</div>
                  <div className="text-2xl font-bold mt-1">67.2%</div>
                </div>
                <div className="w-[75%] py-4 px-6 rounded-lg bg-violet-500 text-white text-center">
                  <div className="text-lg font-bold">Engaged (Like, Comment)</div>
                  <div className="text-2xl font-bold mt-1">39.8%</div>
                </div>
                <div className="w-[45%] py-4 px-6 rounded-lg bg-fuchsia-500 text-white text-center">
                  <div className="text-lg font-bold">Shared Content</div>
                  <div className="text-2xl font-bold mt-1">12.3%</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
