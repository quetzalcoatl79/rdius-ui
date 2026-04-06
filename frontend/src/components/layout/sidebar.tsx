'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Users2,
  Server,
  FileText,
  LogOut,
  ScrollText,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  Radio,
  Settings,
  BookOpen,
} from 'lucide-react';

const mainNavItems = [
  { href: '/', labelKey: 'nav.dashboard' as const, icon: LayoutDashboard },
  { href: '/users', labelKey: 'nav.users' as const, icon: Users },
  { href: '/groups', labelKey: 'nav.groups' as const, icon: Users2 },
  { href: '/nas', labelKey: 'nav.nas' as const, icon: Server },
  { href: '/logs', labelKey: 'nav.logs' as const, icon: FileText },
  { href: '/servers', labelKey: 'nav.servers' as const, icon: Server },
  { href: '/audit', labelKey: 'nav.audit' as const, icon: ScrollText },
];

const bottomNavItems = [
  { href: '/guide', labelKey: 'nav.guide' as const, icon: BookOpen },
  { href: '/settings', labelKey: 'nav.settings' as const, icon: Settings },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <aside
      className={cn(
        'flex flex-col h-screen shrink-0 transition-all duration-300 ease-in-out',
        'bg-sidebar text-sidebar-foreground border-r border-sidebar-border',
        collapsed ? 'w-[68px]' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-4 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary shrink-0">
          <Radio className="h-5 w-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <span className="font-bold text-base tracking-tight text-sidebar-foreground whitespace-nowrap">
              Radius UI
            </span>
            <p className="text-[10px] text-sidebar-foreground/50 leading-none mt-0.5">
              FreeRADIUS Manager
            </p>
          </div>
        )}
      </div>

      {/* Main navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {mainNavItems.map(({ href, labelKey, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? t(labelKey) : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-sidebar-accent text-sidebar-primary shadow-sm'
                  : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
              )}
            >
              <Icon
                className={cn(
                  'h-[18px] w-[18px] shrink-0 transition-colors',
                  active ? 'text-sidebar-primary' : ''
                )}
              />
              {!collapsed && <span>{t(labelKey)}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom nav: guide, settings, collapse */}
      <div className="px-2 py-2 space-y-0.5 border-t border-sidebar-border">
        {bottomNavItems.map(({ href, labelKey, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? t(labelKey) : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-sidebar-accent text-sidebar-primary shadow-sm'
                  : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
              )}
            >
              <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-sidebar-primary' : '')} />
              {!collapsed && <span>{t(labelKey)}</span>}
            </Link>
          );
        })}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm',
            'text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all duration-150'
          )}
          aria-label={collapsed ? t('nav.openMenu') : t('nav.closeMenu')}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-[18px] w-[18px] shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="h-[18px] w-[18px] shrink-0" />
              <span>{t('nav.closeMenu')}</span>
            </>
          )}
        </button>
      </div>

      {/* User info + logout */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        {user && !collapsed && (
          <div className="px-1">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user.email}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <Shield className="h-3 w-3 text-sidebar-foreground/40" />
              <span className="text-xs text-sidebar-foreground/40">
                {t(`role.${user.role}` as 'role.super_admin' | 'role.admin' | 'role.operator' | 'role.viewer')}
              </span>
            </div>
          </div>
        )}
        <button
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm',
            'text-sidebar-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all duration-150',
            collapsed ? 'justify-center px-0' : ''
          )}
          onClick={handleLogout}
          title={t('nav.logout')}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && t('nav.logout')}
        </button>
      </div>
    </aside>
  );
}
