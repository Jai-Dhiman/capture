import type React from "react";
import { Link, useLocation } from "react-router";
import {
  LayoutDashboard,
  Users,
  BarChart2,
  Calendar,
  Settings,
  ShieldAlert,
  MessageSquare,
  Ticket,
  FileText,
  HelpCircle
} from "lucide-react";

import { cn } from "../lib/utils";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";

interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  items: {
    href: string;
    title: string;
    icon: React.ReactNode;
  }[];
  className?: string;
}

export function SidebarNav({ className, items, ...props }: SidebarNavProps) {
  const location = useLocation();
  return (
    <nav className={cn("flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1", className)} {...props}>
      {items.map((item) => (
        <Link
          key={item.href}
          to={item.href}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
            location.pathname === item.href ? "bg-accent" : "transparent"
          )}
        >
          {item.icon}
          {item.title}
        </Link>
      ))}
    </nav>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sidebarNavItems = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      title: "Active Users Report",
      href: "/dashboard/active-users",
      icon: <Users className="h-4 w-4" />,
    },
    {
      title: "Interaction Breakdown",
      href: "/dashboard/interaction-breakdown",
      icon: <BarChart2 className="h-4 w-4" />,
    },
    {
      title: "Activity Report",
      href: "/dashboard/activity-report",
      icon: <Calendar className="h-4 w-4" />,
    },
    {
      title: "Monday Integration",
      href: "/dashboard/monday-integration",
      icon: <Calendar className="h-4 w-4" />,
    },
  ];

  const adminNavItems = [
    {
      title: "Moderation",
      href: "/dashboard/moderation",
      icon: <ShieldAlert className="h-4 w-4" />,
    },
    {
      title: "Support Tickets",
      href: "/dashboard/support-tickets",
      icon: <MessageSquare className="h-4 w-4" />,
    },
    {
      title: "Feedback Tickets",
      href: "/dashboard/feedback-tickets",
      icon: <Ticket className="h-4 w-4" />,
    },
    {
      title: "Important Resources",
      href: "/dashboard/resources",
      icon: <FileText className="h-4 w-4" />,
    },
  ];

  return (
    <div className="grid min-h-screen w-full grid-cols-[240px_1fr]">
      <div className="flex flex-col border-r bg-background">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="flex items-center gap-2 font-semibold">
            <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-white">C</div>
            CAPTURE
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="px-2 py-2">
            <div className="px-3 py-2">
              <h2 className="mb-2 text-xs font-semibold tracking-tight text-muted-foreground">
                ANALYTICS
              </h2>
              <SidebarNav items={sidebarNavItems} />
            </div>
            <Separator className="my-2" />
            <div className="px-3 py-2">
              <h2 className="mb-2 text-xs font-semibold tracking-tight text-muted-foreground">
                ADMIN
              </h2>
              <SidebarNav items={adminNavItems} />
            </div>
          </div>
        </ScrollArea>
      </div>
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-background px-6 sticky top-0 z-10">
          <div className="ml-auto flex items-center gap-4">
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
            <button type="button" className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
              <Settings className="h-4 w-4" />
            </button>
            <div className="h-9 w-9 rounded-full bg-muted-foreground/20 overflow-hidden">
              <img
                src="https://ui.shadcn.com/avatars/01.png"
                alt="User"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
