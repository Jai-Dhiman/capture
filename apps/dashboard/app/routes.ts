import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/index.tsx'),
  route('sign-in/*', 'routes/sign-in.tsx'),
  route('dashboard', 'routes/dashboard/index.tsx', {
    children: [
      index('routes/dashboard/index.tsx'),
      route('active-users', 'routes/dashboard/active-users.tsx'),
      route('interaction-breakdown', 'routes/dashboard/interaction-breakdown.tsx'),
      route('activity-report', 'routes/dashboard/activity-report.tsx'),
    ],
  }),
] satisfies RouteConfig;
