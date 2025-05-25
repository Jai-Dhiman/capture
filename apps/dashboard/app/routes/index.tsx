import type { Route } from "./+types/home";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import ActiveUsersReport, { loader as activeLoader } from "./dashboard/active-users";

export function meta() {
  return [
    { title: "Dashboard - Capture" },
    { name: "description", content: "Live Active Users Dashboard" },
  ];
}

export { activeLoader as loader };

export default function Home() {
  return (
    <DashboardLayout>
      <ActiveUsersReport />
    </DashboardLayout>
  );
}
