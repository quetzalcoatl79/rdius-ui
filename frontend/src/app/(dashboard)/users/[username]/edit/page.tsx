'use client';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { UserForm } from '@/components/radius/UserForm';
import { getUser, updateUser } from '@/lib/radius-api';
import type { AttrRow } from '@/types/radius';
import { ArrowLeft } from 'lucide-react';

interface Props {
  params: Promise<{ username: string }>;
}

export default function UserEditPage({ params }: Props) {
  const { username } = use(params);
  const router = useRouter();
  const qc = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', username],
    queryFn: () => getUser(username),
  });

  const mutation = useMutation({
    mutationFn: (data: { check_attrs: AttrRow[]; reply_attrs: AttrRow[] }) =>
      updateUser(username, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', username] });
      router.push(`/users/${username}`);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-48 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!user) return <p className="text-muted-foreground">Utilisateur introuvable.</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/users/${username}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">
          Modifier {username}
        </h1>
      </div>

      <UserForm
        user={user}
        onSubmit={(data) => mutation.mutate(data)}
        onCancel={() => router.push(`/users/${username}`)}
        isSubmitting={mutation.isPending}
      />
    </div>
  );
}
