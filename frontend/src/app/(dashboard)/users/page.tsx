'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { DataTable, type ColumnDef } from '@/components/radius/DataTable';
import {
  listUsers,
  disableUser,
  enableUser,
  deleteUser,
} from '@/lib/radius-api';
import type { RadUser } from '@/types/radius';
import { UserPlus, Pencil, Trash2 } from 'lucide-react';

export default function UsersPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search],
    queryFn: () => listUsers({ page, page_size: 25, search }),
  });

  const toggleMutation = useMutation({
    mutationFn: (user: RadUser) =>
      user.disabled ? enableUser(user.username) : disableUser(user.username),
    onMutate: async (user) => {
      await qc.cancelQueries({ queryKey: ['users'] });
      const prev = qc.getQueryData(['users', page, search]);
      qc.setQueryData(['users', page, search], (old: typeof data) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((u) =>
            u.username === user.username ? { ...u, disabled: !u.disabled } : u
          ),
        };
      });
      return { prev };
    },
    onError: (_err, _user, ctx) => {
      if (ctx?.prev) qc.setQueryData(['users', page, search], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const handleSearch = useCallback((s: string) => {
    setSearch(s);
    setPage(1);
  }, []);

  const columns: ColumnDef<RadUser>[] = [
    {
      key: 'username',
      header: "Nom d'utilisateur",
      render: (u) => <span className="font-medium">{u.username}</span>,
    },
    {
      key: 'groups',
      header: 'Groupes',
      render: (u) =>
        u.groups.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {u.groups.map((g) => (
              <Badge key={g} variant="secondary" className="text-xs">
                {g}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (u) =>
        u.disabled ? (
          <Badge variant="destructive">Désactivé</Badge>
        ) : (
          <Badge variant="default" className="bg-green-600 hover:bg-green-700">
            Actif
          </Badge>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (u) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/users/${u.username}/edit`)}
          >
            <Pencil className="h-4 w-4 mr-1" />
            Modifier
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={toggleMutation.isPending}
            onClick={() => toggleMutation.mutate(u)}
          >
            {u.disabled ? 'Activer' : 'Désactiver'}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger className="inline-flex items-center rounded-md h-7 px-2.5 text-[0.8rem] gap-1 text-destructive hover:bg-muted transition-colors">
              <Trash2 className="h-4 w-4 mr-1" />
              Supprimer
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer l&apos;utilisateur ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. L&apos;utilisateur{' '}
                  <strong>{u.username}</strong> sera définitivement supprimé.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90"
                  onClick={() => deleteMutation.mutate(u.username)}
                >
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Utilisateurs RADIUS</h1>
        <Button onClick={() => router.push('/users/new')}>
          <UserPlus className="h-4 w-4 mr-2" />
          Ajouter un utilisateur
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
        searchPlaceholder="Rechercher un utilisateur..."
        isLoading={isLoading}
        rowKey={(u) => u.username}
      />
    </div>
  );
}
