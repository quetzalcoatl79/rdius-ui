'use client';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Users,
  UsersRound,
  Server,
  FileText,
  Settings,
  Wifi,
  LogOut,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/users', label: 'Utilisateurs', icon: Users },
  { href: '/groups', label: 'Groupes', icon: UsersRound },
  { href: '/nas', label: 'NAS', icon: Wifi },
  { href: '/logs', label: 'Journaux', icon: FileText },
  { href: '/servers', label: 'Serveurs', icon: Server },
  { href: '/settings', label: 'Paramètres', icon: Settings },
];

export function Sidebar() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <aside className="w-60 flex flex-col h-screen bg-card border-r border-border shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-border">
        <span className="font-bold text-lg tracking-tight">Radius UI</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
          </Link>
        ))}
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
