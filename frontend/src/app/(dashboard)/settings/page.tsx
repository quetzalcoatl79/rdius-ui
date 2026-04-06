'use client';

import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Globe, Moon, Sun, Monitor, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Locale } from '@/lib/i18n';

export default function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  const languages: { value: Locale; label: string; flag: string }[] = [
    { value: 'fr', label: 'Français', flag: '🇫🇷' },
    { value: 'en', label: 'English', flag: '🇬🇧' },
  ];

  const themes = [
    { value: 'light', label: locale === 'fr' ? 'Clair' : 'Light', icon: Sun },
    { value: 'dark', label: locale === 'fr' ? 'Sombre' : 'Dark', icon: Moon },
    { value: 'system', label: locale === 'fr' ? 'Système' : 'System', icon: Monitor },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t('nav.settings')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {locale === 'fr'
            ? "Configurez l'apparence et la langue de l'interface."
            : 'Configure the appearance and language of the interface.'}
        </p>
      </div>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" />
            {locale === 'fr' ? 'Langue' : 'Language'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {languages.map(({ value, label, flag }) => (
              <Button
                key={value}
                variant={locale === value ? 'default' : 'outline'}
                className="gap-2"
                onClick={() => setLocale(value)}
              >
                <span>{flag}</span>
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sun className="h-4 w-4" />
            {locale === 'fr' ? 'Thème' : 'Theme'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {themes.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={theme === value ? 'default' : 'outline'}
                className="gap-2"
                onClick={() => setTheme(value)}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Account info */}
      {user && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              {locale === 'fr' ? 'Compte' : 'Account'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium">{user.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  {locale === 'fr' ? 'Rôle' : 'Role'}
                </dt>
                <dd>
                  <span className="inline-flex items-center rounded-md bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-xs font-semibold">
                    {t(`role.${user.role}` as 'role.super_admin' | 'role.admin' | 'role.operator' | 'role.viewer')}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  {locale === 'fr' ? 'Statut' : 'Status'}
                </dt>
                <dd>
                  <span className={cn(
                    'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold',
                    user.is_active
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      : 'bg-red-500/10 text-red-600 border border-red-500/20'
                  )}>
                    {user.is_active
                      ? (locale === 'fr' ? 'Actif' : 'Active')
                      : (locale === 'fr' ? 'Inactif' : 'Inactive')}
                  </span>
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
