'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  getServers,
  createServer,
  updateServer,
  deleteServer,
  getServerStatus,
  type ServerResponse,
  type ServerCreate,
  type ServerStatus,
  type ServerType,
} from '@/lib/server-api';
import { useServer } from '@/lib/server-context';
import { Plus, Pencil, Trash2, RefreshCw, Container, Globe } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ServerStatus['container_status'] | null }) {
  if (!status) {
    return <Badge className="bg-muted text-muted-foreground border-0 text-xs">...</Badge>;
  }
  const config: Record<string, { label: string; className: string }> = {
    running: { label: 'En ligne', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0 text-xs' },
    stopped: { label: 'Hors ligne', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-0 text-xs' },
    restarting: { label: 'Redémarrage', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-0 text-xs' },
    not_found: { label: 'Introuvable', className: 'bg-muted text-muted-foreground border-0 text-xs' },
    not_configured: { label: 'Non configuré', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-0 text-xs' },
    unknown: { label: 'Inconnu', className: 'bg-muted text-muted-foreground border-0 text-xs' },
  };
  const c = config[status] ?? config.unknown;
  return <Badge className={c.className}>{c.label}</Badge>;
}

function TypeBadge({ type }: { type: ServerType }) {
  if (type === 'remote') {
    return (
      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-0 text-xs gap-1">
        <Globe className="h-3 w-3" /> Distant
      </Badge>
    );
  }
  return (
    <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400 border-0 text-xs gap-1">
      <Container className="h-3 w-3" /> Docker
    </Badge>
  );
}

// ─── Server form ─────────────────────────────────────────────────────────────

interface ServerFormData {
  name: string;
  server_type: ServerType;
  docker_container_id: string;
  remote_host: string;
  remote_port: number;
  remote_user: string;
  remote_restart_cmd: string;
  remote_status_cmd: string;
  description: string;
}

interface ServerFormProps {
  initial?: Partial<ServerFormData>;
  onSubmit: (data: ServerFormData) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  loading: boolean;
}

function ServerForm({ initial, onSubmit, onCancel, submitLabel, loading }: ServerFormProps) {
  const [serverType, setServerType] = useState<ServerType>(initial?.server_type ?? 'docker');
  const [name, setName] = useState(initial?.name ?? '');
  const [containerId, setContainerId] = useState(initial?.docker_container_id ?? '');
  const [remoteHost, setRemoteHost] = useState(initial?.remote_host ?? '');
  const [remotePort, setRemotePort] = useState(initial?.remote_port ?? 22);
  const [remoteUser, setRemoteUser] = useState(initial?.remote_user ?? '');
  const [restartCmd, setRestartCmd] = useState(initial?.remote_restart_cmd ?? 'sudo systemctl restart freeradius');
  const [statusCmd, setStatusCmd] = useState(initial?.remote_status_cmd ?? 'systemctl is-active freeradius');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Le nom est obligatoire'); return; }
    if (serverType === 'docker' && !containerId.trim()) { setError("L'ID du conteneur Docker est obligatoire"); return; }
    if (serverType === 'remote' && !remoteHost.trim()) { setError("L'hôte distant est obligatoire"); return; }
    if (serverType === 'remote' && !remoteUser.trim()) { setError("L'utilisateur SSH est obligatoire"); return; }
    try {
      await onSubmit({
        name: name.trim(),
        server_type: serverType,
        docker_container_id: containerId.trim(),
        remote_host: remoteHost.trim(),
        remote_port: remotePort,
        remote_user: remoteUser.trim(),
        remote_restart_cmd: restartCmd.trim(),
        remote_status_cmd: statusCmd.trim(),
        description: description.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type selector */}
      <div className="space-y-1.5">
        <Label>Type de serveur</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setServerType('docker')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors',
              serverType === 'docker'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            )}
          >
            <Container className="h-4 w-4" />
            Docker
          </button>
          <button
            type="button"
            onClick={() => setServerType('remote')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors',
              serverType === 'remote'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            )}
          >
            <Globe className="h-4 w-4" />
            Distant (SSH)
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="srv-name">Nom *</Label>
        <Input id="srv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="FreeRADIUS Production" required />
      </div>

      {serverType === 'docker' ? (
        <div className="space-y-1.5">
          <Label htmlFor="srv-container">ID conteneur Docker *</Label>
          <Input id="srv-container" value={containerId} onChange={(e) => setContainerId(e.target.value)} placeholder="radius-ui-freeradius-1-1" required />
          <p className="text-xs text-muted-foreground">Le nom ou ID du conteneur Docker qui exécute FreeRADIUS</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="srv-host">Hôte distant *</Label>
              <Input id="srv-host" value={remoteHost} onChange={(e) => setRemoteHost(e.target.value)} placeholder="192.168.1.100" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="srv-port">Port SSH</Label>
              <Input id="srv-port" type="number" value={remotePort} onChange={(e) => setRemotePort(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="srv-user">Utilisateur SSH *</Label>
            <Input id="srv-user" value={remoteUser} onChange={(e) => setRemoteUser(e.target.value)} placeholder="radius" required />
            <p className="text-xs text-muted-foreground">L&apos;utilisateur doit avoir une clé SSH configurée (pas de mot de passe)</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="srv-restart">Commande de redémarrage</Label>
            <Input id="srv-restart" value={restartCmd} onChange={(e) => setRestartCmd(e.target.value)} placeholder="sudo systemctl restart freeradius" className="font-mono text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="srv-status">Commande de statut</Label>
            <Input id="srv-status" value={statusCmd} onChange={(e) => setStatusCmd(e.target.value)} placeholder="systemctl is-active freeradius" className="font-mono text-xs" />
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="srv-desc">Description</Label>
        <Input id="srv-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description optionnelle" />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Annuler</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Sauvegarde...' : submitLabel}</Button>
      </div>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ServersPage() {
  const { user } = useAuth();
  const { refreshServers } = useServer();
  const [servers, setServers] = useState<ServerResponse[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ServerStatus['container_status'] | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<ServerResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServerResponse | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const loadServers = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await getServers();
      setServers(list);
      const statusMap: Record<string, ServerStatus['container_status'] | null> = {};
      list.forEach((s) => { statusMap[s.id] = null; });
      setStatuses(statusMap);
      await Promise.allSettled(
        list.map(async (s) => {
          try {
            const st = await getServerStatus(s.id);
            setStatuses((prev) => ({ ...prev, [s.id]: st.container_status }));
          } catch {
            setStatuses((prev) => ({ ...prev, [s.id]: 'not_found' }));
          }
        })
      );
    } catch { /* empty */ } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadServers(); }, [loadServers]);

  const handleAdd = async (data: ServerFormData) => {
    setFormLoading(true);
    try {
      const payload: ServerCreate = {
        name: data.name,
        server_type: data.server_type,
        description: data.description || undefined,
        ...(data.server_type === 'docker'
          ? { docker_container_id: data.docker_container_id }
          : {
              remote_host: data.remote_host,
              remote_port: data.remote_port,
              remote_user: data.remote_user,
              remote_restart_cmd: data.remote_restart_cmd,
              remote_status_cmd: data.remote_status_cmd,
            }),
      };
      await createServer(payload);
      setShowAddDialog(false);
      await loadServers();
      await refreshServers();
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = async (data: ServerFormData) => {
    if (!editTarget) return;
    setFormLoading(true);
    try {
      await updateServer(editTarget.id, {
        name: data.name,
        server_type: data.server_type,
        docker_container_id: data.server_type === 'docker' ? data.docker_container_id : undefined,
        remote_host: data.server_type === 'remote' ? data.remote_host : undefined,
        remote_port: data.server_type === 'remote' ? data.remote_port : undefined,
        remote_user: data.server_type === 'remote' ? data.remote_user : undefined,
        remote_restart_cmd: data.server_type === 'remote' ? data.remote_restart_cmd : undefined,
        remote_status_cmd: data.server_type === 'remote' ? data.remote_status_cmd : undefined,
        description: data.description || undefined,
      });
      setEditTarget(null);
      await loadServers();
      await refreshServers();
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteServer(deleteTarget.id);
    setDeleteTarget(null);
    await loadServers();
    await refreshServers();
  };

  if (user && user.role !== 'admin' && user.role !== 'super_admin') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Serveurs FreeRADIUS</h1>
        <p className="text-muted-foreground">Accès réservé aux administrateurs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Serveurs FreeRADIUS</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadServers} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Rafraîchir
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un serveur
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nom</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Connexion</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Chargement...</td></tr>
            ) : servers.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Aucun serveur enregistré.</td></tr>
            ) : (
              servers.map((server) => (
                <tr key={server.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/servers/${server.id}`} className="hover:text-primary hover:underline">{server.name}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <TypeBadge type={server.server_type ?? 'docker'} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {server.server_type === 'remote'
                      ? `${server.remote_user}@${server.remote_host}:${server.remote_port}`
                      : server.docker_container_id}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {server.description ?? <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={statuses[server.id] ?? null} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditTarget(server)}>
                        <Pencil className="h-4 w-4 mr-1" /> Modifier
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(server)}>
                        <Trash2 className="h-4 w-4 mr-1" /> Supprimer
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => !open && setShowAddDialog(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Ajouter un serveur</DialogTitle></DialogHeader>
          <ServerForm onSubmit={handleAdd} onCancel={() => setShowAddDialog(false)} submitLabel="Ajouter" loading={formLoading} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editTarget !== null} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Modifier le serveur</DialogTitle></DialogHeader>
          {editTarget && (
            <ServerForm
              initial={{
                name: editTarget.name,
                server_type: editTarget.server_type ?? 'docker',
                docker_container_id: editTarget.docker_container_id ?? '',
                remote_host: editTarget.remote_host ?? '',
                remote_port: editTarget.remote_port ?? 22,
                remote_user: editTarget.remote_user ?? '',
                remote_restart_cmd: editTarget.remote_restart_cmd ?? 'sudo systemctl restart freeradius',
                remote_status_cmd: editTarget.remote_status_cmd ?? 'systemctl is-active freeradius',
                description: editTarget.description ?? '',
              }}
              onSubmit={handleEdit}
              onCancel={() => setEditTarget(null)}
              submitLabel="Enregistrer"
              loading={formLoading}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le serveur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer <strong>{deleteTarget?.name}</strong> retirera ce serveur de l&apos;interface. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
