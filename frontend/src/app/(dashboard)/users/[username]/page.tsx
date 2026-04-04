'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getUser } from '@/lib/radius-api';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeftIcon,
  ShieldCheckIcon,
  WifiIcon,
  BookOpenIcon,
  UserIcon,
} from 'lucide-react';

export default function UserDetailPage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username);

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user', username],
    queryFn: () => getUser(username),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-6 w-48 bg-muted rounded animate-pulse" />
        <div className="h-4 w-32 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-6">
        <p className="text-destructive">Utilisateur introuvable ou erreur de chargement.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" render={<Link href="/users" />}>
          <ArrowLeftIcon />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{user.username}</h1>
            {user.disabled && (
              <Badge variant="destructive">Désactivé</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {user.groups.length > 0
              ? `Groupes : ${user.groups.join(', ')}`
              : 'Aucun groupe assigné'}
          </p>
        </div>
      </div>

      {/* Attributes summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground">Attributs de vérification</p>
          <p className="text-2xl font-semibold">{user.check_attrs.length}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground">Attributs de réponse</p>
          <p className="text-2xl font-semibold">{user.reply_attrs.length}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground">Groupes</p>
          <p className="text-2xl font-semibold">{user.groups.length}</p>
        </div>
      </div>

      {/* Navigation cards to sub-pages */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Observabilité</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href={`/users/${encodeURIComponent(username)}/auth-history`}
            className="block"
          >
            <Card className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
              <div className="flex items-start gap-3">
                <ShieldCheckIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Historique d'authentification</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Accès acceptés et refusés par FreeRADIUS
                  </p>
                </div>
              </div>
            </Card>
          </Link>
          <Link
            href={`/users/${encodeURIComponent(username)}/sessions`}
            className="block"
          >
            <Card className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
              <div className="flex items-start gap-3">
                <WifiIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Historique des sessions</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Durée, données transférées et cause d'arrêt
                  </p>
                </div>
              </div>
            </Card>
          </Link>
          <Link
            href={`/users/${encodeURIComponent(username)}/effective-policy`}
            className="block"
          >
            <Card className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
              <div className="flex items-start gap-3">
                <BookOpenIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Politique effective</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Attributs fusionnés utilisateur + groupes
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </div>

      {/* Check attributes */}
      {user.check_attrs.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Attributs de vérification</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-2 text-left font-medium">Attribut</th>
                  <th className="px-3 py-2 text-left font-medium">Op.</th>
                  <th className="px-3 py-2 text-left font-medium">Valeur</th>
                </tr>
              </thead>
              <tbody>
                {user.check_attrs.map((attr) => (
                  <tr key={attr.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{attr.attribute}</td>
                    <td className="px-3 py-2 text-muted-foreground">{attr.op}</td>
                    <td className="px-3 py-2 font-mono text-xs">{attr.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reply attributes */}
      {user.reply_attrs.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Attributs de réponse</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-2 text-left font-medium">Attribut</th>
                  <th className="px-3 py-2 text-left font-medium">Op.</th>
                  <th className="px-3 py-2 text-left font-medium">Valeur</th>
                </tr>
              </thead>
              <tbody>
                {user.reply_attrs.map((attr) => (
                  <tr key={attr.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{attr.attribute}</td>
                    <td className="px-3 py-2 text-muted-foreground">{attr.op}</td>
                    <td className="px-3 py-2 font-mono text-xs">{attr.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {user.check_attrs.length === 0 && user.reply_attrs.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <UserIcon className="h-4 w-4" />
          <span>Aucun attribut défini pour cet utilisateur.</span>
        </div>
      )}
    </div>
  );
}
