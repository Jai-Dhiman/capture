import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  type LoaderFunctionArgs,
  useLoaderData,
} from "react-router";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type Metrics = Array<{
  date: string;
  totalUsers: number;
  activeUsers: number;
}>;

export async function loader({ context }: LoaderFunctionArgs) {
  const db = context.cloudflare.env.DB;
  const days = 30;
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  const isoStart = start.toISOString();

  // 1) active users per day
  const activity = await db
    .prepare(
      `SELECT date(created_at) AS date,
              COUNT(DISTINCT user_id) AS activeUsers
       FROM user_activity
       WHERE created_at >= ?
       GROUP BY date
       ORDER BY date`
    )
    .bind(isoStart)
    .all();

  // 2) signups per day
  const signup = await db
    .prepare(
      `SELECT date(created_at) AS date,
              COUNT(*) AS signups
       FROM profile
       WHERE created_at >= ?
       GROUP BY date`
    )
    .bind(isoStart)
    .all();

  // 3) build a full 30-day window and initialize per-day data
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }

  // 4) count profiles that existed before our window
  const countBeforeResult = await db
    .prepare('SELECT COUNT(*) AS count FROM profile WHERE created_at < ?')
    .bind(isoStart)
    .all();
  const beforeCount = Number(countBeforeResult.results[0]?.count || 0);

  // 5) initialize signups and activeUsers to zero for each date
  const map: Record<string, { date: string; signups: number; activeUsers: number }> = {};
  for (const date of dates) {
    map[date] = { date, signups: 0, activeUsers: 0 };
  }

  // 6) populate map from our signup and activity queries
  for (const entry of signup.results as any[]) {
    const key = entry.date as string;
    if (map[key]) {
      map[key].signups = Number(entry.signups);
    }
  }
  for (const entry of activity.results as any[]) {
    const key = entry.date as string;
    if (map[key]) {
      map[key].activeUsers = Number(entry.activeUsers);
    }
  }

  // 7) compute cumulative totalUsers per day
  let cumulative = beforeCount;
  const metrics: Metrics = dates.map((date) => {
    cumulative += map[date].signups;
    return { date, totalUsers: cumulative, activeUsers: map[date].activeUsers };
  });

  // 4) return a standard Response
  return new Response(JSON.stringify({ metrics }), {
    headers: { "Content-Type": "application/json" },
  });
}

export function meta() {
  return [
    { title: "Active Users Report - Capture" },
    { name: "description", content: "Active Users Analytics for Capture Platform" },
  ];
}

export default function ActiveUsersReport() {
  // 5) useLoaderData from react-router
  const { metrics } = useLoaderData() as { metrics: Metrics };

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Active Users Report</h1>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Monthly Active Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {metrics[metrics.length - 1].activeUsers}
          </div>
          <div className="h-96 mt-4">
            <ResponsiveContainer width="100%" height={384}>
              <LineChart data={metrics}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="totalUsers" stroke="#5A6ACF" dot={false} />
                <Line type="monotone" dataKey="activeUsers" stroke="#E6E8EC" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
