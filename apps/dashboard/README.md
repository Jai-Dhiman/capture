# Capture Analytics Dashboard

A comprehensive analytics dashboard for monitoring the Capture social media platform built with SvelteKit and Tailwind CSS.

## Features

### 📊 Core Analytics
- **User Metrics**: Total users, verified users, growth trends, verification rates
- **Content Metrics**: Posts, comments, engagement rates, content activity
- **Engagement Analytics**: Likes, saves, follows, user interaction patterns
- **Real-time Activity**: 24-hour activity summaries and recent trends

### 🎨 Dashboard Components
- **MetricCard**: Reusable metric display with trend indicators
- **SimpleChart**: SVG-based line charts for growth visualization
- **TopUsersTable**: Leaderboard of most engaged users
- **Responsive Design**: Mobile-friendly layout with Tailwind CSS

### 🔄 Data Integration
- **Real-time Updates**: Auto-refresh every 5 minutes
- **Error Handling**: Graceful fallbacks and error states
- **Loading States**: Skeleton loaders and progress indicators
- **API Integration**: Direct connection to Cloudflare Workers backend

## API Endpoints

The dashboard consumes the following analytics endpoints:

- `GET /api/analytics/overview` - Platform overview metrics
- `GET /api/analytics/user-growth` - 30-day user growth trends
- `GET /api/analytics/content-activity` - Content creation patterns
- `GET /api/analytics/top-users` - Most engaged users ranking
- `GET /api/analytics/recent-activity` - 24-hour activity summary

## Setup & Development

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm
- Cloudflare Workers server running locally

### Installation

1. Install dependencies:
```bash
pnpm install
```

2. Set environment variables:
```bash
# .env.local
PUBLIC_API_URL=http://localhost:8787  # Your Cloudflare Workers API URL
```

3. Start development server:
```bash
pnpm dev
```

The dashboard will be available at `http://localhost:5173`

### Production Build

```bash
pnpm build
pnpm preview
```

## Architecture

```
dashboard/
├── src/
│   ├── lib/
│   │   ├── components/          # Reusable analytics components
│   │   │   ├── MetricCard.svelte
│   │   │   ├── SimpleChart.svelte
│   │   │   └── TopUsersTable.svelte
│   │   ├── api.ts              # API client with analytics endpoints
│   │   ├── config.ts           # Environment configuration
│   │   └── types.ts            # TypeScript interfaces
│   ├── routes/
│   │   ├── +layout.svelte      # Navigation layout
│   │   ├── +page.svelte        # Health monitoring page
│   │   └── analytics/
│   │       └── +page.svelte    # Main analytics dashboard
│   └── app.css                 # Tailwind CSS imports
```

## Key Features

### 🔍 Health Monitoring
- API server status monitoring
- D1 database connection health
- Real-time connectivity checks
- Error diagnostics and troubleshooting

### 📈 Analytics Dashboard
- Platform growth visualization
- User engagement metrics
- Content performance tracking
- Top contributors leaderboard

### 🎯 Performance Optimized
- Parallel API calls for faster loading
- Efficient data caching strategies
- Responsive design for all devices
- Minimal JavaScript bundle size

### 🛡️ Error Resilience
- Graceful API error handling
- Loading state management
- Network retry mechanisms
- User-friendly error messages

## Usage

### Navigation
- **Health**: Monitor API and database status
- **Analytics**: View comprehensive platform metrics

### Dashboard Features
- **Auto-refresh**: Data updates every 5 minutes
- **Manual refresh**: Click refresh button for immediate updates
- **Time ranges**: View 24-hour, weekly, and monthly trends
- **Interactive charts**: Hover for detailed data points

## Data Sources

The dashboard aggregates data from:
- **Users Table**: Registration and verification metrics
- **Posts Table**: Content creation and engagement data
- **Comments Table**: Discussion and interaction metrics  
- **Relationships Table**: Follow/connection patterns
- **Activity Logs**: Real-time user behavior tracking

## Contributing

When adding new analytics features:

1. Create reusable components in `/src/lib/components/`
2. Add TypeScript interfaces in `/src/lib/types.ts`
3. Extend API client in `/src/lib/api.ts`
4. Update dashboard layout for new metrics
5. Test with loading and error states

## Deployment

The dashboard can be deployed to:
- **Cloudflare Pages**: Static site hosting
- **Vercel**: Serverless deployment
- **Netlify**: JAMstack hosting
- **Traditional hosting**: Build and serve static files

Set the `PUBLIC_API_URL` environment variable to your production API endpoint.