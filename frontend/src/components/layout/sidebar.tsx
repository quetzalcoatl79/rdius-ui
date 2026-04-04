'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Users2,
  Server,
  FileText,
  Settings,
  LogOut,
  Activity,
  ShieldCheck,
  ScrollText,
} from 'lucide-react';
import { ServerSelector } from '@/components/layout/server-selector';

const navItems = [
  { href: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/users', label: 'Utilisateurs', icon: Users },
  { href: '/groups', label: 'Groupes', icon: Users2 },
  { href: '/nas', label: 'Équipements NAS', icon: Server },
  { href: '/settings', label: 'Paramètres', icon: Settings },
];

const logItems = [
  { href: '/logs', label: 'Comptabilité', icon: FileText },
  { href: '/logs/sessions', label: 'Sessions actives', icon: Activity },
  { href: '/logs/postauth', label: 'Post-auth', icon: ShieldCheck },
];

const adminItems = [
  { href: '/servers', label: 'Serveurs', icon: Server },
  { href: '/audit', label: "Journal d'audit", icon: ScrollText },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const handleLogout = async () => {
    await logout();
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <aside className="w-60 flex flex-col h-screen bg-card border-r border-border shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-border">
        <span className="font-bold text-lg tracking-tight">Radius UI</span>
      </div>

      {/* Server selector */}
      <ServerSelector />
      <div className="border-b border-border" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              isActive(href)
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
          </Link>
        ))}

        {/* Journaux section */}
        <div className="pt-2">
          <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Journaux
          </p>
          {logItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive(href)
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </Link>
          ))}
        </div>

        {/* Administration section */}
        <div className="pt-2">
          <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Administration
          </p>
          {adminItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive(href)
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* User info + logout */}
      <div className="border-t border-border p-4 space-y-2">
        {user && (
          <div className="px-1">
            <p className="text-sm font-medium truncate">{user.full_name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Déconnexion
        </Button>
      </div>
    </aside>
  );
}
