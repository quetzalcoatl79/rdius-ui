'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  getGroup,
  assignUserToGroup,
  removeUserFromGroup,
} from '@/lib/radius-api';
import { DataTable, type ColumnDef } from '@/components/radius/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ArrowLeftIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import type { RadUserGroupMember } from '@/types/radius';

export default function GroupDetailPage() {
  const params = useParams<{ groupname: string }>();
  const groupname = decodeURIComponent(params.groupname);
  const queryClient = useQueryClient();

  const [addUsername, setAddUsername] = useState('');
  const [addPriority, setAddPriority] = useState(1);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const { data: group, isLoading, error } = useQuery({
    queryKey: ['group', groupname],
    queryFn: () => getGroup(groupname),
  });

  const addMemberMutation = useMutation({
    mutationFn: (data: { username: string; priority: number }) =>
      assignUserToGroup(groupname, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupname] });
      setAddUsername('');
      setAddPriority(1);
      setAddError(null);
      setAddDialogOpen(false);
    },
    onError: (err: Error) => {
      setAddError(err.message);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (username: string) => removeUserFromGroup(groupname, username),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupname] });
    },
  });

  const sortedMembers = [...(group?.members ?? [])].sort(
    (a, b) => a.priority - b.priority
  );

  const columns: ColumnDef<RadUserGroupMember>[] = [
    {
      key: 'username',
      header: "Nom d'utilisateur",
      render: (row) => (
        <Link
          href={`/users/${encodeURIComponent(row.username)}`}
          className="text-primary hover:underline"
        >
          {row.username}
        </Link>
      ),
    },
    {
      key: 'priority',
      header: 'Priorité',
      render: (row) => row.priority,
      className: 'w-24',
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <AlertDialog>
          <AlertDialogTrigger>
            <Button variant="ghost" size="icon-sm" aria-label="Retirer le membre">
              <Trash2Icon className="h-4 w-4 text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Retirer le membre</AlertDialogTitle>
              <AlertDialogDescription>
                Retirer <strong>{row.username}</strong> du groupe{' '}
                <strong>{groupname}</strong> ? Cette action ne supprime pas l&apos;utilisateur.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => removeMemberMutation.mutate(row.username)}
                className="bg-destructive/10 text-destructive hover:bg-destructive/20"
              >
                Retirer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ),
      className: 'w-16',
    },
  ];

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-6 w-48 bg-muted rounded animate-pulse" />
        <div className="h-4 w-32 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="p-6">
        <p className="text-destructive">Groupe introuvable ou erreur de chargement.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm">
          <Link href="/groups">
            <ArrowLeftIcon />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{group.groupname}</h1>
          <p className="text-sm text-muted-foreground">
            {sortedMembers.length} membre{sortedMembers.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Attributes summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground">Attributs de vérification</p>
          <p className="text-2xl font-semibold">{group.check_attrs.length}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground">Attributs de réponse</p>
          <p className="text-2xl font-semibold">{group.reply_attrs.length}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground">Membres</p>
          <p className="text-2xl font-semibold">{sortedMembers.length}</p>
        </div>
      </div>

      {/* Members section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Membres</h2>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger>
              <Button size="sm">
                <PlusIcon className="h-4 w-4 mr-1" />
                Ajouter un membre
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter un membre au groupe</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="add-username">Nom d&apos;utilisateur</Label>
                  <Input
                    id="add-username"
                    placeholder="ex: jdoe"
                    value={addUsername}
                    onChange={(e) => setAddUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="add-priority">Priorité</Label>
                  <Input
                    id="add-priority"
                    type="number"
                    min={0}
                    value={addPriority}
                    onChange={(e) => setAddPriority(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Valeur plus basse = priorité plus haute
                  </p>
                </div>
                {addError && (
                  <p className="text-sm text-destructive">{addError}</p>
                )}
              </div>
              <DialogFooter>
                <DialogClose>
                  <Button variant="outline">Annuler</Button>
                </DialogClose>
                <Button
                  onClick={() =>
                    addMemberMutation.mutate({
                      username: addUsername.trim(),
                      priority: addPriority,
                    })
                  }
                  disabled={!addUsername.trim() || addMemberMutation.isPending}
                >
                  {addMemberMutation.isPending ? 'Ajout...' : 'Ajouter'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <DataTable
          columns={columns}
          data={sortedMembers}
          total={sortedMembers.length}
          page={1}
          pageSize={sortedMembers.length || 1}
          isLoading={isLoading}
          emptyMessage="Aucun utilisateur assigné à ce groupe"
          onPageChange={() => {}}
          onSearch={() => {}}
          rowKey={(row) => row.username}
        />
      </div>

      {/* Check attributes */}
      {group.check_attrs.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Attributs de vérification du groupe
          </h2>
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
                {group.check_attrs.map((attr) => (
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
      {group.reply_attrs.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Attributs de réponse du groupe
          </h2>
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
                {group.reply_attrs.map((attr) => (
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
    </div>
  );
}
