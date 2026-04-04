'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
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
import { DataTable, type ColumnDef } from '@/components/radius/DataTable';
import { listNas, deleteNas, getNasSecret } from '@/lib/radius-api';
import type { Nas } from '@/types/radius';
import { Plus, Pencil, Trash2, Eye, Copy, Check } from 'lucide-react';

export default function NasPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Nas | null>(null);
  const [secretDialog, setSecretDialog] = useState<{ nasId: number; secret: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [secretTimer, setSecretTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['nas', page, search],
    queryFn: () => listNas({ page, page_size: 25, search }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteNas(id),
    onSuccess: () => {
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['nas'] });
    },
  });

  const handleSearch = useCallback((s: string) => {
    setSearch(s);
    setPage(1);
  }, []);

  const handleRevealSecret = async (nas: Nas) => {
    setSecretDialog({ nasId: nas.id, secret: null });
    const result = await getNasSecret(nas.id);
    setSecretDialog({ nasId: nas.id, secret: result.secret });
    // Auto-hide after 30s
    if (secretTimer) clearTimeout(secretTimer);
    const timer = setTimeout(() => setSecretDialog(null), 30000);
    setSecretTimer(timer);
  };

  const handleCopySecret = async (secret: string) => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const columns: ColumnDef<Nas>[] = [
    {
      key: 'nasname',
      header: 'IP / Nom',
      render: (n) => <span className="font-mono text-sm">{n.nasname}</span>,
    },
    {
      key: 'shortname',
      header: 'Nom court',
      render: (n) => n.shortname ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (n) => n.type,
    },
    {
      key: 'description',
      header: 'Description',
      render: (n) => n.description ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'secret',
      header: 'Secret',
      render: () => <span className="font-mono text-muted-foreground">***</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (n) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/nas/${n.id}`)}
          >
            <Pencil className="h-4 w-4 mr-1" />
            Modifier
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRevealSecret(n)}
          >
            <Eye className="h-4 w-4 mr-1" />
            Voir le secret
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteTarget(n)}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Supprimer
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Équipements NAS</h1>
        <Button onClick={() => router.push('/nas/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un équipement
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        page={page}
        pageSize={25}
        onPageChange={setPage}
        onSearch={handleSearch}
        searchPlaceholder="Rechercher un équipement..."
        isLoading={isLoading}
        rowKey={(n) => n.id}
      />

      {/* Secret reveal dialog */}
      <Dialog
        open={secretDialog !== null}
        onOpenChange={(open) => !open && setSecretDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Secret partagé</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {secretDialog?.secret === null ? (
              <div className="h-8 bg-muted rounded animate-pulse" />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-sm bg-muted px-3 py-2 rounded-md break-all">
                    {secretDialog?.secret}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => secretDialog?.secret && handleCopySecret(secretDialog.secret)}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ce secret sera masqué automatiquement dans 30 secondes.
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l&apos;équipement NAS ?</AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer <strong>{deleteTarget?.nasname}</strong> nécessite un redémarrage de
              FreeRADIUS. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Supprimer et redémarrer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
