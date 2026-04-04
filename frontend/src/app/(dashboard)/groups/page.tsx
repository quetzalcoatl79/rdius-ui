'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
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
import { listGroups, deleteGroup } from '@/lib/radius-api';
import type { RadGroup } from '@/types/radius';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function GroupsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['groups', page, search],
    queryFn: () => listGroups({ page, page_size: 25, search }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => {
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['groups'] });
    },
  });

  const handleSearch = useCallback((s: string) => {
    setSearch(s);
    setPage(1);
  }, []);

  const columns: ColumnDef<RadGroup>[] = [
    {
      key: 'groupname',
      header: 'Nom du groupe',
      render: (g) => (
        <button
          className="font-medium text-primary hover:underline"
          onClick={() => router.push(`/groups/${g.groupname}`)}
        >
          {g.groupname}
        </button>
      ),
    },
    {
      key: 'attrs',
      header: "Nb d'attributs",
      render: (g) => g.check_attrs.length + g.reply_attrs.length,
    },
    {
      key: 'members',
      header: 'Nb de membres',
      render: (g) => g.members.length,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (g) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/groups/${g.groupname}`)}
          >
            <Pencil className="h-4 w-4 mr-1" />
            Modifier
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteTarget(g.groupname)}
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
        <h1 className="text-2xl font-bold tracking-tight">Groupes RADIUS</h1>
        <Button onClick={() => router.push('/groups/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un groupe
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
        searchPlaceholder="Rechercher un groupe..."
        isLoading={isLoading}
        rowKey={(g) => g.groupname}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le groupe ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le groupe{' '}
              <strong>{deleteTarget}</strong> sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
