import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("dashboard", "routes/dashboard.tsx", {
    children: [
      index("routes/home.tsx"),
      route("active-users", "routes/dashboard.active-users.tsx"),
      route("interaction-breakdown", "routes/dashboard.interaction-breakdown.tsx"),
      route("activity-report", "routes/dashboard.activity-report.tsx"),
    ],
  }),
] satisfies RouteConfig;
