'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  getServer,
  getServerStatus,
  getServerHealth,
  updateServer,
  restartServer,
  type ServerResponse,
  type ServerStatus,
  type ServerHealth,
} from '@/lib/server-api';
import { useServer } from '@/lib/server-context';
import { formatDate } from '@/lib/format';
import { ChevronLeft, RotateCcw, Pencil, RefreshCw } from 'lucide-react';

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ServerStatus['container_status'] }) {
  const config: Record<ServerStatus['container_status'], { label: string; className: string }> = {
    running: {
      label: 'En ligne',
      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0',
    },
    stopped: {
      label: 'Hors ligne',
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-0',
    },
    restarting: {
      label: 'Redémarrage',
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-0',
    },
    not_found: {
      label: 'Introuvable',
      className: 'bg-muted text-muted-foreground border-0',
    },
    not_configured: {
      label: 'Non configuré',
      className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-0',
    },
    unknown: {
      label: 'Inconnu',
      className: 'bg-muted text-muted-foreground border-0',
    },
  };
  const { label, className } = config[status];
  return <Badge className={className}>{label}</Badge>;
}

// ─── Format uptime ────────────────────────────────────────────────────────────

function formatUptime(seconds: number | null): string {
  if (seconds === null || seconds < 0) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days} jour${days > 1 ? 's' : ''}, ${hours}h ${mins}min`;
  if (hours > 0) return `${hours}h ${mins}min`;
  return `${mins}min`;
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  const color = clamped > 85 ? 'bg-red-500' : clamped > 60 ? 'bg-yellow-500' : 'bg-primary';
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full ${color} transition-all duration-300`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

// ─── Edit form ────────────────────────────────────────────────────────────────

interface EditFormProps {
  server: ServerResponse;
  onSave: (name: string, container: string, description: string) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

function EditForm({ server, onSave, onCancel, loading }: EditFormProps) {
  const [name, setName] = useState(server.name);
  const [container, setContainer] = useState(server.docker_container_id ?? '');
  const [description, setDescription] = useState(server.description ?? '');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || (server.server_type !== 'remote' && !container.trim())) {
      setError('Le nom et l\'ID du conteneur sont obligatoires');
      return;
    }
    try {
      await onSave(name.trim(), container.trim(), description.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="edit-name">Nom *</Label>
        <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="edit-container">ID conteneur Docker *</Label>
        <Input id="edit-container" value={container} onChange={(e) => setContainer(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="edit-desc">Description</Label>
        <Input id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Annuler
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Sauvegarde...' : 'Enregistrer'}
        </Button>
      </div>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ServerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const { refreshServers } = useServer();

  const [server, setServer] = useState<ServerResponse | null>(null);
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const [restartLoading, setRestartLoading] = useState(false);
  const [restartMessage, setRestartMessage] = useState('');

  const healthIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [srv, st, h] = await Promise.all([
        getServer(id),
        getServerStatus(id),
        getServerHealth(id),
      ]);
      setServer(srv);
      setStatus(st);
      setHealth(h);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const refreshHealth = useCallback(async () => {
    try {
      const h = await getServerHealth(id);
      setHealth(h);
    } catch {
      // Silently ignore health refresh errors
    }
  }, [id]);

  useEffect(() => {
    loadData();
    // Auto-refresh health every 30 seconds
    healthIntervalRef.current = setInterval(refreshHealth, 30000);
    return () => {
      if (healthIntervalRef.current) clearInterval(healthIntervalRef.current);
    };
  }, [loadData, refreshHealth]);

  const handleSave = async (name: string, container: string, description: string) => {
    setEditLoading(true);
    try {
      const updated = await updateServer(id, {
        name,
        docker_container_id: container,
        description: description || null,
      });
      setServer(updated);
      setShowEditDialog(false);
      await refreshServers();
    } finally {
      setEditLoading(false);
    }
  };

  const handleRestart = async () => {
    setRestartLoading(true);
    setRestartMessage('');
    try {
      const result = await restartServer(id);
      setRestartMessage(result.message);
      setShowRestartDialog(false);
      // Refresh status after 3 seconds to show new state
      setTimeout(async () => {
        try {
          const st = await getServerStatus(id);
          setStatus(st);
        } catch {
          // Ignore
        }
      }, 3000);
    } catch (err) {
      setRestartMessage(err instanceof Error ? err.message : 'Erreur lors du redémarrage');
    } finally {
      setRestartLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Détail du serveur</h1>
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (error || !server) {
    return (
      <div className="space-y-4">
        <Link href="/servers" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          Retour aux serveurs
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Erreur</h1>
        <p className="text-destructive">{error || 'Serveur introuvable'}</p>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/servers" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Retour aux serveurs
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{server.name}</h1>
          <p className="text-muted-foreground text-sm mt-1 font-mono">{server.docker_container_id}</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Modifier
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowRestartDialog(true)}
                disabled={restartLoading}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Redémarrer le serveur
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Restart message */}
      {restartMessage && (
        <div className="rounded-md border border-border bg-card p-3 text-sm">
          {restartMessage}
        </div>
      )}

      {/* Server info */}
      <div className="rounded-md border border-border bg-card p-4 space-y-3">
        <h2 className="font-semibold text-sm uppercase text-muted-foreground tracking-wider">Informations</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Nom</p>
            <p className="font-medium">{server.name}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Conteneur Docker</p>
            <p className="font-mono">{server.docker_container_id}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Description</p>
            <p>{server.description ?? <span className="text-muted-foreground/50">—</span>}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Enregistré le</p>
            <p>{formatDate(server.created_at)}</p>
          </div>
        </div>
      </div>

      {/* Status section */}
      <div className="rounded-md border border-border bg-card p-4 space-y-3">
        <h2 className="font-semibold text-sm uppercase text-muted-foreground tracking-wider">Statut</h2>
        {status ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">État du conteneur</p>
              <div className="mt-1">
                <StatusBadge status={status.container_status} />
              </div>
            </div>
            <div>
              <p className="text-muted-foreground">Temps de fonctionnement</p>
              <p className="font-medium">{formatUptime(status.uptime_seconds)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Démarré le</p>
              <p>{formatDate(status.started_at)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Dernier redémarrage</p>
              <p>{formatDate(status.last_restart)}</p>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Statut indisponible</p>
        )}
      </div>

      {/* Health section */}
      <div className="rounded-md border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm uppercase text-muted-foreground tracking-wider">Santé</h2>
          <span className="text-xs text-muted-foreground">Actualisation automatique toutes les 30s</span>
        </div>
        {health ? (
          <div className="space-y-4">
            {/* CPU */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span>CPU</span>
                <span className="font-mono font-medium">{health.cpu_percent.toFixed(1)}%</span>
              </div>
              <ProgressBar value={health.cpu_percent} />
            </div>
            {/* Memory */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span>Mémoire</span>
                <span className="font-mono font-medium">
                  {health.memory_usage_mb.toFixed(0)} MB / {health.memory_limit_mb.toFixed(0)} MB
                  <span className="text-muted-foreground ml-1">({health.memory_percent.toFixed(1)}%)</span>
                </span>
              </div>
              <ProgressBar value={health.memory_percent} />
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Métriques de santé indisponibles</p>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={refreshHealth}
          className="text-muted-foreground"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser maintenant
        </Button>
      </div>

      {/* Edit dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => !open && setShowEditDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le serveur</DialogTitle>
          </DialogHeader>
          <EditForm
            server={server}
            onSave={handleSave}
            onCancel={() => setShowEditDialog(false)}
            loading={editLoading}
          />
        </DialogContent>
      </Dialog>

      {/* Restart confirmation */}
      <AlertDialog
        open={showRestartDialog}
        onOpenChange={(open) => !open && setShowRestartDialog(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redémarrer le serveur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir redémarrer <strong>{server.name}</strong> ?
              Les sessions actives seront interrompues.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restartLoading}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleRestart}
              disabled={restartLoading}
            >
              {restartLoading ? 'Redémarrage...' : 'Redémarrer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
