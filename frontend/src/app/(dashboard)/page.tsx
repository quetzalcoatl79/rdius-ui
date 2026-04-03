'use client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Wifi, Server, Activity } from 'lucide-react';

const statCards = [
  { label: 'Utilisateurs', value: '0', icon: Users, description: 'Comptes RADIUS' },
  { label: 'Sessions actives', value: '0', icon: Activity, description: 'Connexions en cours' },
  { label: 'NAS', value: '0', icon: Wifi, description: 'Points d\'accès configurés' },
  { label: 'Serveurs', value: '0', icon: Server, description: 'Instances FreeRADIUS' },
];

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Bienvenue sur Radius UI
        </h2>
        {user && (
          <p className="text-muted-foreground mt-1">
            Connecté en tant que{' '}
            <span className="font-medium text-foreground">{user.email}</span>
            {' — '}
            <span className="text-sm">{user.role}</span>
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, description }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
