import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";

export function meta() {
  return [
    { title: "Activity Report - Capture" },
    { name: "description", content: "Activity Report for Capture Platform" },
  ];
}

export default function ActivityReport() {
  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Activity Report</h1>
        <div className="relative">
          <input
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 w-[300px] pl-8"
            placeholder="Search for something"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="lucide lucide-search absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mt-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">133,243,232</div>
            <div className="absolute top-4 right-4 h-8 w-8 rounded-full bg-cyan-100" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Threads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">543,245,894,321</div>
            <div className="absolute top-4 right-4 h-8 w-8 rounded-full bg-pink-100" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Interactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">80%</div>
            <div className="absolute top-4 right-4 h-8 w-8 rounded-full bg-blue-100" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Total Comments</CardTitle>
          </CardHeader>
          <CardContent className="h-[220px]">
            <div className="h-full w-full flex items-end gap-10 justify-between px-4">
              <div className="flex flex-col items-center">
                <div className="h-[20px] w-1 bg-amber-500 rounded-full" />
                <div className="text-xs text-muted-foreground mt-2">May</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="h-[90px] w-1 bg-amber-500 rounded-full" />
                <div className="text-xs text-muted-foreground mt-2">Jun</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="h-[70px] w-1 bg-amber-500 rounded-full" />
                <div className="text-xs text-muted-foreground mt-2">Jul</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="h-[150px] w-1 bg-amber-500 rounded-full" />
                <div className="text-xs text-muted-foreground mt-2">Aug</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="h-[80px] w-1 bg-amber-500 rounded-full" />
                <div className="text-xs text-muted-foreground mt-2">Sep</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="h-[120px] w-1 bg-amber-500 rounded-full" />
                <div className="text-xs text-muted-foreground mt-2">Oct</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Total Saves</CardTitle>
          </CardHeader>
          <CardContent className="h-[220px]">
            <div className="w-full h-full rounded-md overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-t from-transparent to-emerald-500/10" />
              <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-emerald-500/20 to-transparent" />
              <div className="absolute bottom-0 h-[80%] w-full" style={{
                background: 'linear-gradient(90deg, transparent 0%, transparent 100%)',
                borderTop: '2px solid #10b981',
                borderTopLeftRadius: '50%',
                borderTopRightRadius: '50%'
              }} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Trending Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-pink-100" />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">#FDT</div>
                    <div className="text-sm text-green-500">+16%</div>
                  </div>
                  <div className="text-xs text-muted-foreground">First Used: May 10th, 25</div>
                  <div className="text-xs text-muted-foreground">54,000 Total Uses</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-blue-100" />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">#Demi</div>
                    <div className="text-sm text-red-500">-4%</div>
                  </div>
                  <div className="text-xs text-muted-foreground">First Used: Aug 4th, 25</div>
                  <div className="text-xs text-muted-foreground">25,300 Total Uses</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-amber-100" />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">#Elon</div>
                    <div className="text-sm text-green-500">+25%</div>
                  </div>
                  <div className="text-xs text-muted-foreground">First Used: Oct 6th, 25</div>
                  <div className="text-xs text-muted-foreground">8,200 Total Uses</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trending Profiles (Followers Gained)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>UserID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Followers</TableHead>
                  <TableHead>Increase</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>#33248397</TableCell>
                  <TableCell>@charliebenado</TableCell>
                  <TableCell>$320</TableCell>
                  <TableCell className="text-green-500">+5%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>#91254789</TableCell>
                  <TableCell>@epple</TableCell>
                  <TableCell>$480</TableCell>
                  <TableCell className="text-green-500">+16%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>#91254567</TableCell>
                  <TableCell>@nintendoe</TableCell>
                  <TableCell>$350</TableCell>
                  <TableCell className="text-red-500">-3%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>#00000001</TableCell>
                  <TableCell>@capture</TableCell>
                  <TableCell>$540</TableCell>
                  <TableCell className="text-green-500">+7%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>#91225637</TableCell>
                  <TableCell>@hopehoude</TableCell>
                  <TableCell>$670</TableCell>
                  <TableCell className="text-red-500">-12%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
