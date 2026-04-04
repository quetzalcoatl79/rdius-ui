'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
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
import { createNas } from '@/lib/radius-api';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

export default function NewNasPage() {
  const router = useRouter();
  const [pendingValues, setPendingValues] = useState<NasFormValues | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: createNas,
    onSuccess: (result) => {
      if (result.restart_triggered) {
        // Toast would go here in a full implementation
        console.info('NAS ajouté et FreeRADIUS redémarré');
      } else {
        console.warn('NAS ajouté mais le redémarrage a échoué — redémarrage manuel requis');
      }
      router.push('/nas');
    },
  });

  const handleFormSubmit = (values: NasFormValues) => {
    setPendingValues(values);
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (!pendingValues) return;
    setConfirmOpen(false);
    mutation.mutate({
      nasname: pendingValues.nasname,
      shortname: pendingValues.shortname || null,
      type: pendingValues.type,
      ports: pendingValues.ports ? parseInt(pendingValues.ports, 10) : null,
      secret: pendingValues.secret,
      server: pendingValues.server || null,
      community: pendingValues.community || null,
      description: pendingValues.description || null,
    });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/nas')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Ajouter un équipement NAS</h1>
      </div>

      <div className="flex items-start gap-3 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-900/50 dark:bg-orange-950/20">
        <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
        <p className="text-sm text-orange-800 dark:text-orange-300">
          L&apos;ajout d&apos;un équipement NAS nécessite un redémarrage de FreeRADIUS.
          Une confirmation sera demandée avant de procéder.
        </p>
      </div>

      {mutation.isError && (
        <p className="text-sm text-destructive">
          {(mutation.error as Error).message || "Erreur lors de l'ajout"}
        </p>
      )}

      <NasForm
        onSubmit={handleFormSubmit}
        onCancel={() => router.push('/nas')}
        isSubmitting={mutation.isPending}
      />

      {/* Restart confirmation dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redémarrage requis</AlertDialogTitle>
            <AlertDialogDescription>
              Ajouter cet équipement NAS nécessite un redémarrage de FreeRADIUS.
              Souhaitez-vous continuer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Redémarrer et ajouter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
