'use client';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { GroupForm } from '@/components/radius/GroupForm';
import { createGroup } from '@/lib/radius-api';
import type { AttrRow } from '@/types/radius';
import { ArrowLeft } from 'lucide-react';

export default function NewGroupPage() {
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: createGroup,
    onSuccess: (group) => {
      router.push(`/groups/${group.groupname}`);
    },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/groups')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Créer un groupe</h1>
      </div>

      {mutation.isError && (
        <p className="text-sm text-destructive">
          {(mutation.error as Error).message || 'Erreur lors de la création'}
        </p>
      )}

      <GroupForm
        onSubmit={(data: { groupname: string; check_attrs: AttrRow[]; reply_attrs: AttrRow[] }) =>
          mutation.mutate(data)
        }
        onCancel={() => router.push('/groups')}
        isSubmitting={mutation.isPending}
      />
    </div>
  );
}
