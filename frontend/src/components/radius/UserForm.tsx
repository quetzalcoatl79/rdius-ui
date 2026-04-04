'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AttributeEditor } from '@/components/radius/AttributeEditor';
import type { RadUser, AttrRow } from '@/types/radius';

interface UserFormProps {
  user?: RadUser;
  onSubmit: (data: {
    check_attrs: AttrRow[];
    reply_attrs: AttrRow[];
  }) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function UserForm({ user, onSubmit, onCancel, isSubmitting }: UserFormProps) {
  const [checkAttrs, setCheckAttrs] = useState<AttrRow[]>(
    (user?.check_attrs ?? []).map(({ attribute, op, value }) => ({ attribute, op, value }))
  );
  const [replyAttrs, setReplyAttrs] = useState<AttrRow[]>(
    (user?.reply_attrs ?? []).map(({ attribute, op, value }) => ({ attribute, op, value }))
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ check_attrs: checkAttrs, reply_attrs: replyAttrs });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label>Nom d&apos;utilisateur</Label>
        <Input value={user?.username ?? ''} disabled className="bg-muted" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Attributs de vérification</CardTitle>
        </CardHeader>
        <CardContent>
          <AttributeEditor attrs={checkAttrs} onChange={setCheckAttrs} context="check" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Attributs de réponse</CardTitle>
        </CardHeader>
        <CardContent>
          <AttributeEditor attrs={replyAttrs} onChange={setReplyAttrs} context="reply" />
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
