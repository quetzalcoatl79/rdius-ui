'use client';
import { useAuth } from '@/lib/auth';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  operator: 'Opérateur',
  viewer: 'Lecteur',
};

export function Header() {
  const { user } = useAuth();

  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-6 shrink-0">
      <h1 className="text-sm font-medium text-muted-foreground">
        Interface de gestion FreeRADIUS
      </h1>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        {user && (
          <>
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
              {roleLabels[user.role] ?? user.role}
            </span>
            <span className="text-sm font-medium">{user.full_name}</span>
          </>
        )}
      </div>
    </header>
  );
}
