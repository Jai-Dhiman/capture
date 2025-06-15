'use client';

import { useClerk, useUser } from '@clerk/clerk-react';
import {
  BarChart2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Search as LucideSearch,
  MessageSquare,
  ShieldAlert,
  Ticket,
  Users,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';

import { cn } from '../../lib/utils';
import { AuthMiddleware } from '../auth/RequireAuth';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';

interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  items: {
    href: string;
    title: string;
    icon: React.ReactNode;
  }[];
  className?: string;
}

export function SidebarNav({
  className,
  items,
  collapsed,
  ...props
}: SidebarNavProps & { collapsed?: boolean }) {
  const location = useLocation();
  return (
    <nav className={cn('flex flex-col gap-1', className)} {...props}>
      {items.map((item) => (
        <Link
          key={item.href}
          to={item.href}
          aria-label={item.title}
          className={cn(
            'flex items-center gap-3 rounded-lg transition-colors px-3 py-2 text-sm font-medium font-poppins hover:bg-indigo-50 hover:text-indigo-600',
            location.pathname === item.href ? 'bg-indigo-100 text-indigo-700' : 'text-slate-800',
            collapsed ? 'justify-center px-2' : 'justify-start px-3',
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
  const { user } = useUser();
  const { signOut } = useClerk();

  const sidebarNavItems = [
    {
      title: 'Dashboard',
      href: '/',
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      title: 'Active Users Report',
      href: '/dashboard/active-users',
      icon: <Users className="h-4 w-4" />,
    },
    {
      title: 'Interaction Breakdown',
      href: '/dashboard/interaction-breakdown',
      icon: <BarChart2 className="h-4 w-4" />,
    },
    {
      title: 'Activity Report',
      href: '/dashboard/activity-report',
      icon: <Calendar className="h-4 w-4" />,
    },
    {
      title: 'Monday Integration',
      href: '/dashboard/monday-integration',
      icon: <Calendar className="h-4 w-4" />,
    },
  ];

  const adminNavItems = [
    {
      title: 'Moderation',
      href: '/dashboard/moderation',
      icon: <ShieldAlert className="h-4 w-4" />,
    },
    {
      title: 'Support Tickets',
      href: '/dashboard/support-tickets',
      icon: <MessageSquare className="h-4 w-4" />,
    },
    {
      title: 'Feedback Tickets',
      href: '/dashboard/feedback-tickets',
      icon: <Ticket className="h-4 w-4" />,
    },
    {
      title: 'Important Resources',
      href: '/dashboard/resources',
      icon: <FileText className="h-4 w-4" />,
    },
  ];

  const handleSignOut = () => {
    signOut();
  };

  return (
    <AuthMiddleware>
      <div
        className={cn(
          'grid min-h-screen w-full transition-all duration-300',
          sidebarCollapsed ? 'grid-cols-[72px_1fr]' : 'grid-cols-[260px_1fr]',
        )}
      >
        {/* Sidebar */}
        <aside
          className={cn(
            'flex flex-col border-r bg-gray-100 transition-all duration-300 shadow-md dark:bg-gray-900 dark:border-gray-800',
            sidebarCollapsed ? 'w-[72px]' : 'w-[260px]',
          )}
        >
          {/* Logo and Collapse Button */}
          <div className="flex h-16 items-center justify-between px-4 border-b dark:border-gray-800">
            <button
              type="button"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="ml-2 p-1 rounded hover:bg-indigo-100 transition-colors dark:hover:bg-indigo-900"
              onClick={() => setSidebarCollapsed((v) => !v)}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-5 h-5 text-indigo-500" />
              ) : (
                <ChevronLeft className="w-5 h-5 text-indigo-500" />
              )}
            </button>
          </div>
          <ScrollArea className="flex-1">
            <div className="py-4">
              <div className={cn('px-3 py-2', sidebarCollapsed && 'px-1')}>
                {!sidebarCollapsed && (
                  <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase font-poppins transition-all duration-200 dark:text-slate-400">
                    ANALYTICS
                  </h2>
                )}
                <SidebarNav items={sidebarNavItems} collapsed={sidebarCollapsed} />
              </div>
              <Separator className="my-2" />
              <div className={cn('px-3 py-2', sidebarCollapsed && 'px-1')}>
                {!sidebarCollapsed && (
                  <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase font-poppins transition-all duration-200 dark:text-slate-400">
                    ADMIN
                  </h2>
                )}
                <SidebarNav items={adminNavItems} collapsed={sidebarCollapsed} />
              </div>
            </div>
          </ScrollArea>

          {/* Sign out button at bottom of sidebar */}
          <div className="border-t border-gray-200 p-3 dark:border-gray-800">
            <button
              type="button"
              onClick={handleSignOut}
              className={cn(
                'flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20',
                sidebarCollapsed ? 'justify-center' : 'justify-start gap-3',
              )}
            >
              <LogOut className="h-4 w-4" />
              {!sidebarCollapsed && <span>Sign out</span>}
            </button>
          </div>
        </aside>
        {/* Main Content Area */}
        <div className="flex flex-col">
          {/* Header */}
          <header className="flex h-16 items-center gap-4 border-b bg-white px-6 sticky top-0 z-10 shadow-sm dark:bg-gray-900 dark:border-gray-800">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-xl">
              <input
                className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-4 pl-10 text-sm font-poppins text-blue-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all dark:bg-gray-800 dark:border-gray-700 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:ring-indigo-700"
                placeholder="Search"
                aria-label="Search"
              />
              <LucideSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
            </div>

            {/* User info and theme toggle */}
            <div className="flex items-center gap-4 ml-auto">
              {user && (
                <div className="flex items-center">
                  <div className="mr-2 text-sm font-medium hidden sm:block">
                    {user.firstName || user.username || user.emailAddresses[0]?.emailAddress}
                  </div>
                  <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden">
                    {user.imageUrl ? (
                      <img
                        src={user.imageUrl}
                        alt={user.firstName || 'User'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-medium text-indigo-600">
                        {(
                          user.firstName?.[0] ||
                          user.emailAddresses[0]?.emailAddress?.[0] ||
                          'U'
                        ).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </header>
          {/* Main Dashboard Content */}
          <main className="flex-1 p-8 bg-white overflow-auto rounded-tl-2xl dark:bg-gray-900">
            {children}
          </main>
        </div>
      </div>
    </AuthMiddleware>
  );
}

export default DashboardLayout;
