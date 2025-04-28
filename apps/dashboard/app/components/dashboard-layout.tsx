import type React from "react";
import { useState } from "react";
import { Link, useLocation } from "react-router";
import {
  LayoutDashboard,
  Users,
  BarChart2,
  Calendar,
  ShieldAlert,
  MessageSquare,
  Ticket,
  FileText,
  ChevronLeft,
  ChevronRight,
  Search as LucideSearch
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

export function SidebarNav({ className, items, collapsed, ...props }: SidebarNavProps & { collapsed?: boolean }) {
  const location = useLocation();
  return (
    <nav className={cn("flex flex-col gap-1", className)} {...props}>
      {items.map((item) => (
        <Link
          key={item.href}
          to={item.href}
          aria-label={item.title}
          className={cn(
            "flex items-center gap-3 rounded-lg transition-colors px-3 py-2 text-sm font-medium font-poppins hover:bg-indigo-50 hover:text-indigo-600",
            location.pathname === item.href ? "bg-indigo-100 text-indigo-700" : "text-slate-800",
            collapsed ? "justify-center px-2" : "justify-start px-3"
          )}
        >
          {item.icon}
          {!collapsed && <span className="transition-opacity duration-200">{item.title}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
    <div className={cn("grid min-h-screen w-full transition-all duration-300", sidebarCollapsed ? "grid-cols-[72px_1fr]" : "grid-cols-[260px_1fr]")}>
      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col border-r bg-gray-100 transition-all duration-300 shadow-md",
        sidebarCollapsed ? "w-[72px]" : "w-[260px]"
      )}>
        {/* Logo and Collapse Button */}
        <div className="flex h-16 items-center justify-between px-4 border-b">
          <button
            type="button"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="ml-2 p-1 rounded hover:bg-indigo-100 transition-colors"
            onClick={() => setSidebarCollapsed((v) => !v)}
          >
            {sidebarCollapsed ? <ChevronRight className="w-5 h-5 text-indigo-500" /> : <ChevronLeft className="w-5 h-5 text-indigo-500" />}
          </button>
        </div>
        <ScrollArea className="flex-1">
          <div className="py-4">
            <div className={cn("px-3 py-2", sidebarCollapsed && "px-1")}>
              <h2 className={cn(
                "mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase font-poppins transition-all duration-200",
                sidebarCollapsed && "text-center"
              )}>ANALYTICS</h2>
              <SidebarNav items={sidebarNavItems} collapsed={sidebarCollapsed} />
            </div>
            <Separator className="my-2" />
            <div className={cn("px-3 py-2", sidebarCollapsed && "px-1")}>
              <h2 className={cn(
                "mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase font-poppins transition-all duration-200",
                sidebarCollapsed && "text-center"
              )}>ADMIN</h2>
              <SidebarNav items={adminNavItems} collapsed={sidebarCollapsed} />
            </div>
          </div>
        </ScrollArea>
      </aside>
      {/* Main Content Area */}
      <div className="flex flex-col">
        {/* Header */}
        <header className="flex h-16 items-center gap-4 border-b bg-white px-6 sticky top-0 z-10 shadow-sm">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-xl">
            <input
              className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-4 pl-10 text-sm font-poppins text-blue-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
              placeholder="Search"
              aria-label="Search"
            />
            <LucideSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          </div>
        </header>
        {/* Main Dashboard Content */}
        <main className="flex-1 p-8 bg-white overflow-auto rounded-tl-2xl">
          {children}
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;