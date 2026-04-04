'use client';
import { use, useState } from 'react';
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
import { NasForm, type NasFormValues } from '@/components/radius/NasForm';
import { getNas, updateNas, deleteNas } from '@/lib/radius-api';
import { ArrowLeft, Trash2 } from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

type ConfirmType = 'update' | 'delete';

export default function NasDetailPage({ params }: Props) {
  const { id: idStr } = use(params);
  const id = parseInt(idStr, 10);
  const router = useRouter();
  const qc = useQueryClient();

  const [confirmType, setConfirmType] = useState<ConfirmType | null>(null);
  const [pendingValues, setPendingValues] = useState<NasFormValues | null>(null);

  const { data: nas, isLoading } = useQuery({
    queryKey: ['nas', id],
    queryFn: () => getNas(id),
  });

  const updateMutation = useMutation({
    mutationFn: (values: NasFormValues) =>
      updateNas(id, {
        nasname: values.nasname,
        shortname: values.shortname || null,
        type: values.type,
        ports: values.ports ? parseInt(values.ports, 10) : null,
        secret: values.secret || null,
        server: values.server || null,
        community: values.community || null,
        description: values.description || null,
      }),
    onSuccess: (result) => {
      if (result.restart_triggered) {
        console.info('NAS mis à jour et FreeRADIUS redémarré');
      } else {
        console.warn('NAS mis à jour mais le redémarrage a échoué — redémarrage manuel requis');
      }
      qc.invalidateQueries({ queryKey: ['nas'] });
      router.push('/nas');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteNas(id),
    onSuccess: () => {
      router.push('/nas');
    },
  });

  const handleFormSubmit = (values: NasFormValues) => {
    setPendingValues(values);
    setConfirmType('update');
  };

  const handleConfirmUpdate = () => {
    if (!pendingValues) return;
    setConfirmType(null);
    updateMutation.mutate(pendingValues);
  };

  const handleConfirmDelete = () => {
    setConfirmType(null);
    deleteMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!nas) return <p className="text-muted-foreground">Équipement introuvable.</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/nas')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{nas.nasname}</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive border-destructive hover:bg-destructive/10"
          onClick={() => setConfirmType('delete')}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Supprimer
        </Button>
      </div>

      {(updateMutation.isError || deleteMutation.isError) && (
        <p className="text-sm text-destructive">
          {((updateMutation.error || deleteMutation.error) as Error)?.message || 'Erreur'}
        </p>
      )}

      <NasForm
        nas={nas}
        onSubmit={handleFormSubmit}
        onCancel={() => router.push('/nas')}
        isSubmitting={updateMutation.isPending}
        isEdit
      />

      {/* Update confirmation dialog */}
      <AlertDialog
        open={confirmType === 'update'}
        onOpenChange={(open) => !open && setConfirmType(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redémarrage requis</AlertDialogTitle>
            <AlertDialogDescription>
              Modifier cet équipement NAS nécessite un redémarrage de FreeRADIUS.
              Souhaitez-vous continuer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUpdate}>
              Redémarrer et enregistrer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={confirmType === 'delete'}
        onOpenChange={(open) => !open && setConfirmType(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l&apos;équipement NAS ?</AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer <strong>{nas.nasname}</strong> nécessite un redémarrage de FreeRADIUS.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleConfirmDelete}
            >
              Supprimer et redémarrer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
