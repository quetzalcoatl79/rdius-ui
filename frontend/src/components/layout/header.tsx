'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Globe, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const pageTitleKeys: Record<string, string> = {
  '/': 'nav.dashboard',
  '/users': 'nav.users',
  '/groups': 'nav.groups',
  '/nas': 'nav.nas',
  '/logs': 'nav.logs',
  '/servers': 'nav.servers',
  '/audit': 'nav.audit',
  '/settings': 'nav.settings',
  '/guide': 'nav.guide',
};

export function Header() {
  const { user } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const pathname = usePathname();

  const titleKey =
    pageTitleKeys[pathname] ??
    Object.entries(pageTitleKeys).find(
      ([path]) => path !== '/' && pathname.startsWith(path)
    )?.[1] ??
    null;

  const title = titleKey ? t(titleKey as 'nav.dashboard') : 'Radius UI';

  // Build breadcrumb segments
  const segments = pathname.split('/').filter(Boolean);

  const toggleLocale = () => {
    setLocale(locale === 'fr' ? 'en' : 'fr');
  };

  return (
    <header className="h-14 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-6 shrink-0 sticky top-0 z-10">
      <div className="flex items-center gap-2">
        {segments.length > 0 ? (
          <nav className="flex items-center gap-1 text-sm">
            <span className="text-muted-foreground">Radius UI</span>
            {segments.map((seg, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                <span
                  className={cn(
                    i === segments.length - 1
                      ? 'font-semibold text-foreground'
                      : 'text-muted-foreground'
                  )}
                >
                  {i === 0 && titleKey
                    ? title
                    : decodeURIComponent(seg)}
                </span>
              </span>
            ))}
          </nav>
        ) : (
          <h1 className="text-base font-semibold">{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Language toggle */}
        <button
          onClick={toggleLocale}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title={locale === 'fr' ? 'Switch to English' : 'Passer en français'}
        >
          <Globe className="h-3.5 w-3.5" />
          {locale.toUpperCase()}
        </button>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* User info */}
        {user && (
          <div className="flex items-center gap-2.5 ml-1 pl-2.5 border-l border-border">
            <span className="inline-flex items-center rounded-md bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-[11px] font-semibold">
              {t(`role.${user.role}` as 'role.super_admin' | 'role.admin' | 'role.operator' | 'role.viewer')}
            </span>
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user.email}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
