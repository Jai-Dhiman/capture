import { Outlet } from "react-router";
import { DashboardLayout } from "../../components/layout/DashboardLayout";

export default function Dashboard() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}
