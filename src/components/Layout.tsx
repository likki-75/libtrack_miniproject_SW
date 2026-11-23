import React, { useState } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  BookPlus,
  BookCheck,
  History,
  FlaskConical,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  BookOpenCheck,
} from 'lucide-react';
import type { User } from '../types';

export type NavSection =
  | 'dashboard'
  | 'books'
  | 'students'
  | 'issue'
  | 'return'
  | 'history'
  | 'testing'
  | 'settings';

interface LayoutProps {
  user: User;
  libraryName: string;
  activeNav: NavSection;
  onNavigate: (section: NavSection) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'books', label: 'Books', icon: BookOpen },
  { id: 'students', label: 'Students', icon: Users, adminOnly: true },
  { id: 'issue', label: 'Issue Books', icon: BookPlus, adminOnly: true },
  { id: 'return', label: 'Return Books', icon: BookCheck, adminOnly: true },
  { id: 'history', label: 'Borrowing History', icon: History },
  { id: 'testing', label: 'Testing Dashboard', icon: FlaskConical },
  { id: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
];

export function Layout({
  user,
  libraryName,
  activeNav,
  onNavigate,
  onLogout,
  children,
}: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleNav = NAV_ITEMS.filter((item) => !item.adminOnly || user.role === 'admin');
  const activeItem = visibleNav.find((item) => item.id === activeNav) ?? visibleNav[0];

  const handleSelect = (id: NavSection) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Mobile Sidebar Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Left Collapsible Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-white transition-all duration-150 lg:static ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${collapsed ? 'lg:w-[76px]' : 'w-64'}`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <BookOpenCheck className="h-5 w-5" />
            </div>
            {!collapsed && (
              <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap truncate">
                LibTrack
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation drawer"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main Navigation">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`nav-${item.id}`}
                onClick={() => handleSelect(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                } ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-3 space-y-1 shrink-0">
          <button
            type="button"
            data-testid="nav-logout"
            onClick={onLogout}
            title={collapsed ? 'Logout' : undefined}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-700 transition-colors whitespace-nowrap ${
              collapsed ? 'lg:justify-center lg:px-2' : ''
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-30 h-16 border-b border-slate-200 bg-white px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden lg:flex rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-slate-400 truncate max-w-[220px]">{libraryName}</span>
              <span className="hidden sm:inline text-slate-300">/</span>
              <h1 className="font-display text-base font-semibold text-slate-900 truncate">
                {activeItem?.label ?? 'Dashboard'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium text-slate-900 leading-tight">{user.name}</span>
              <span className="text-xs text-slate-500 leading-tight">
                {user.role === 'admin' ? 'Administrator' : `Student · ${user.studentId ?? ''}`}
              </span>
            </div>
            {user.role === 'admin' && activeNav !== 'issue' && (
              <button
                type="button"
                onClick={() => onNavigate('issue')}
                className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
              >
                Issue Book
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
