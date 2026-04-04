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
} from '@/lib/server-api';
import { useServer } from '@/lib/server-context';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import Link from 'next/link';

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ServerStatus['container_status'] | null }) {
  if (!status) {
    return (
      <Badge className="bg-muted text-muted-foreground border-0 text-xs">
        Chargement...
      </Badge>
    );
  }
  const config: Record<ServerStatus['container_status'], { label: string; className: string }> = {
    running: {
      label: 'En ligne',
      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0 text-xs',
    },
    stopped: {
      label: 'Hors ligne',
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-0 text-xs',
    },
    restarting: {
      label: 'Redémarrage',
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-0 text-xs',
    },
    not_found: {
      label: 'Introuvable',
      className: 'bg-muted text-muted-foreground border-0 text-xs',
    },
  };
  const { label, className } = config[status];
  return <Badge className={className}>{label}</Badge>;
}

// ─── Server form ─────────────────────────────────────────────────────────────

interface ServerFormData {
  name: string;
  docker_container_id: string;
  description: string;
}

interface ServerFormProps {
  initial?: ServerFormData;
  onSubmit: (data: ServerFormData) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  loading: boolean;
}

function ServerForm({ initial, onSubmit, onCancel, submitLabel, loading }: ServerFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [containerId, setContainerId] = useState(initial?.docker_container_id ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Le nom est obligatoire'); return; }
    if (!containerId.trim()) { setError("L'ID du conteneur Docker est obligatoire"); return; }
    try {
      await onSubmit({ name: name.trim(), docker_container_id: containerId.trim(), description: description.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="srv-name">Nom *</Label>
        <Input
          id="srv-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="FreeRADIUS 1"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="srv-container">ID conteneur Docker *</Label>
        <Input
          id="srv-container"
          value={containerId}
          onChange={(e) => setContainerId(e.target.value)}
          placeholder="freeradius-1"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="srv-desc">Description</Label>
        <Input
          id="srv-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description optionnelle"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Annuler
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Sauvegarde...' : submitLabel}
        </Button>
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
      // Fetch statuses in parallel (non-blocking)
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
    } catch {
      // Keep empty list
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  const handleAdd = async (data: ServerFormData) => {
    setFormLoading(true);
    try {
      const payload: ServerCreate = {
        name: data.name,
        docker_container_id: data.docker_container_id,
        description: data.description || null,
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
        docker_container_id: data.docker_container_id,
        description: data.description || null,
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
    try {
      await deleteServer(deleteTarget.id);
      setDeleteTarget(null);
      await loadServers();
      await refreshServers();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // Role guard
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
      {/* Header */}
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

      {/* Table */}
      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nom</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Conteneur Docker</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted-foreground">
                  Chargement...
                </td>
              </tr>
            ) : servers.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted-foreground">
                  Aucun serveur enregistré. Cliquez sur &quot;Ajouter un serveur&quot; pour commencer.
                </td>
              </tr>
            ) : (
              servers.map((server) => (
                <tr key={server.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/servers/${server.id}`} className="hover:text-primary hover:underline">
                      {server.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {server.docker_container_id}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {server.description ?? <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={statuses[server.id] ?? null} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditTarget(server)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Modifier
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(server)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Supprimer
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un serveur</DialogTitle>
          </DialogHeader>
          <ServerForm
            onSubmit={handleAdd}
            onCancel={() => setShowAddDialog(false)}
            submitLabel="Ajouter"
            loading={formLoading}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editTarget !== null} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le serveur</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <ServerForm
              initial={{
                name: editTarget.name,
                docker_container_id: editTarget.docker_container_id,
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
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le serveur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer <strong>{deleteTarget?.name}</strong> retirera ce serveur de l&apos;interface.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
