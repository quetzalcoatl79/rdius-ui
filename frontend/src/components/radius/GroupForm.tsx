'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AttributeEditor } from '@/components/radius/AttributeEditor';
import type { RadGroup, AttrRow } from '@/types/radius';

interface GroupFormProps {
  group?: RadGroup;
  onSubmit: (data: {
    groupname: string;
    check_attrs: AttrRow[];
    reply_attrs: AttrRow[];
  }) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function GroupForm({ group, onSubmit, onCancel, isSubmitting }: GroupFormProps) {
  const [groupname, setGroupname] = useState(group?.groupname ?? '');
  const [checkAttrs, setCheckAttrs] = useState<AttrRow[]>(
    (group?.check_attrs ?? []).map(({ attribute, op, value }) => ({ attribute, op, value }))
  );
  const [replyAttrs, setReplyAttrs] = useState<AttrRow[]>(
    (group?.reply_attrs ?? []).map(({ attribute, op, value }) => ({ attribute, op, value }))
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ groupname, check_attrs: checkAttrs, reply_attrs: replyAttrs });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="groupname">Nom du groupe</Label>
        {group ? (
          <Input value={groupname} disabled className="bg-muted" />
        ) : (
          <Input
            id="groupname"
            placeholder="ex: wifi-users"
            value={groupname}
            onChange={(e) => setGroupname(e.target.value)}
            required
          />
        )}
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
          {isSubmitting
            ? 'Enregistrement...'
            : group
            ? 'Enregistrer'
            : 'Créer le groupe'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
