import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Pagination } from "../../components/ui/pagination";

export function meta() {
  return [
    { title: "Active Users Report - Capture" },
    { name: "description", content: "Active Users Analytics for Capture Platform" },
  ];
}

export default function ActiveUsersReport() {
  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Active Users Report</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">April 2022</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Approx. 2,134</div>
            <div className="flex justify-between mt-1">
              <div className="text-xs text-muted-foreground">Last Month</div>
              <div className="text-xs text-muted-foreground">Percent Increase</div>
            </div>
            <div className="flex justify-between">
              <div className="font-medium">1,002</div>
              <div className="text-green-500 font-medium">12%</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Time Spent on Capture</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2 hours</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Interaction per User (month)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">324</div>
          </CardContent>
        </Card>

        <Card className="col-span-1 row-span-1 bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-white/80">Daily Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,324</div>
            <div className="flex justify-between mt-2">
              <div className="flex flex-col items-center gap-1">
                <div className="h-20 w-4 bg-white/20 rounded-sm relative overflow-hidden">
                  <div className="absolute bottom-0 left-0 right-0 bg-white/60 h-[30%]" />
                </div>
                <span className="text-xs">Aug</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="h-20 w-4 bg-white/20 rounded-sm relative overflow-hidden">
                  <div className="absolute bottom-0 left-0 right-0 bg-white/60 h-[45%]" />
                </div>
                <span className="text-xs">Sep</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="h-20 w-4 bg-white/20 rounded-sm relative overflow-hidden">
                  <div className="absolute bottom-0 left-0 right-0 bg-white/60 h-[55%]" />
                </div>
                <span className="text-xs">Oct</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="h-20 w-4 bg-white/20 rounded-sm relative overflow-hidden">
                  <div className="absolute bottom-0 left-0 right-0 bg-white/60 h-[40%]" />
                </div>
                <span className="text-xs">Nov</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="h-20 w-4 bg-white/20 rounded-sm relative overflow-hidden">
                  <div className="absolute bottom-0 left-0 right-0 bg-white/60 h-[90%]" />
                </div>
                <span className="text-xs">Dec</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="h-20 w-4 bg-white/20 rounded-sm relative overflow-hidden">
                  <div className="absolute bottom-0 left-0 right-0 bg-white/60 h-[65%]" />
                </div>
                <span className="text-xs">Jan</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Total Accounts: 214,212,001</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Interactions: 324,382,321</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Creations</CardTitle>
          </CardHeader>
          <Tabs defaultValue="all-accounts" className="px-6">
            <TabsList>
              <TabsTrigger value="all-accounts">All Accounts</TabsTrigger>
              <TabsTrigger value="flags">Flags</TabsTrigger>
              <TabsTrigger value="verification">Verification Applications</TabsTrigger>
            </TabsList>
            <TabsContent value="all-accounts" className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>First Name, Last Initial</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Redirect</TableHead>
                    <TableHead>Flag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>+</TableCell>
                    <TableCell>Sameer S.</TableCell>
                    <TableCell>#12548793</TableCell>
                    <TableCell>Private</TableCell>
                    <TableCell>****9667</TableCell>
                    <TableCell>28 Jan, 12:30 AM</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-600 hover:bg-emerald-50">Instagram</Badge>
                    </TableCell>
                    <TableCell>
                      <button type="button" className="px-3 py-1 text-sm border rounded-md hover:bg-slate-50">Flag</button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>+</TableCell>
                    <TableCell>Frank T.</TableCell>
                    <TableCell>#12548794</TableCell>
                    <TableCell>Private</TableCell>
                    <TableCell>****4324</TableCell>
                    <TableCell>25 Jan, 10:40 PM</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-cyan-50 text-cyan-600 hover:bg-cyan-50">X.com</Badge>
                    </TableCell>
                    <TableCell>
                      <button type="button" className="px-3 py-1 text-sm border rounded-md hover:bg-slate-50">Flag</button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>+</TableCell>
                    <TableCell>Jai D.</TableCell>
                    <TableCell>#12548795</TableCell>
                    <TableCell>Public</TableCell>
                    <TableCell>****5432</TableCell>
                    <TableCell>20 Jan, 10:40 PM</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-600 hover:bg-emerald-50">Instagram</Badge>
                    </TableCell>
                    <TableCell>
                      <button type="button" className="px-3 py-1 text-sm border rounded-md hover:bg-slate-50">Flag</button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>+</TableCell>
                    <TableCell>Jon C.</TableCell>
                    <TableCell>#12548796</TableCell>
                    <TableCell>Private</TableCell>
                    <TableCell>****4235</TableCell>
                    <TableCell>15 Jan, 03:29 PM</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-blue-50 text-blue-600 hover:bg-blue-50">Website</Badge>
                    </TableCell>
                    <TableCell>
                      <button type="button" className="px-3 py-1 text-sm border rounded-md hover:bg-slate-50">Flag</button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>+</TableCell>
                    <TableCell>CNN</TableCell>
                    <TableCell>#B12548797</TableCell>
                    <TableCell>Business</TableCell>
                    <TableCell>****6784</TableCell>
                    <TableCell>14 Jan, 10:40 PM</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-50 text-green-600 hover:bg-green-50">App Store</Badge>
                    </TableCell>
                    <TableCell>
                      <button type="button" className="px-3 py-1 text-sm border rounded-md hover:bg-slate-50">Flag</button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <div className="flex items-center justify-center py-4">
                <Pagination>
                  <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                    Page 1 of 10
                  </div>
                </Pagination>
              </div>
            </TabsContent>
            <TabsContent value="flags" className="pt-4">
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <p>Flagged accounts would appear here</p>
              </div>
            </TabsContent>
            <TabsContent value="verification" className="pt-4">
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <p>Verification applications would appear here</p>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </>
  );
}
