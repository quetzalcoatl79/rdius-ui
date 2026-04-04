'use client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import type { AttrRow } from '@/types/radius';

const CHECK_OPS = [
  { value: ':=', label: ':= (Affecter)' },
  { value: '==', label: '== (Égal)' },
  { value: '+=', label: '+= (Ajouter)' },
  { value: '!=', label: '!= (Différent)' },
];

const REPLY_OPS = [
  { value: ':=', label: ':= (Affecter)' },
  { value: '=', label: '= (Définir)' },
  { value: '+=', label: '+= (Ajouter)' },
];

interface AttributeEditorProps {
  attrs: AttrRow[];
  onChange: (attrs: AttrRow[]) => void;
  context: 'check' | 'reply';
}

function isPasswordAttr(attribute: string): boolean {
  return attribute.toLowerCase().includes('password');
}

export function AttributeEditor({ attrs, onChange, context }: AttributeEditorProps) {
  const ops = context === 'check' ? CHECK_OPS : REPLY_OPS;

  const addRow = () => {
    onChange([...attrs, { attribute: '', op: ':=', value: '' }]);
  };

  const removeRow = (index: number) => {
    onChange(attrs.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: keyof AttrRow, val: string) => {
    const next = attrs.map((row, i) => {
      if (i !== index) return row;
      const updated = { ...row, [field]: val };
      // Force := for Password attributes in check context
      if (context === 'check' && isPasswordAttr(updated.attribute)) {
        updated.op = ':=';
      }
      return updated;
    });
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {attrs.map((row, i) => {
        const forceOp = context === 'check' && isPasswordAttr(row.attribute);
        return (
          <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Attribute name */}
            <Input
              className="flex-1 min-w-0"
              placeholder="Attribut"
              value={row.attribute}
              onChange={(e) => updateRow(i, 'attribute', e.target.value)}
            />

            {/* Operator */}
            {forceOp ? (
              <div
                className="w-full sm:w-36 h-9 border rounded-md px-3 flex items-center text-sm bg-muted text-muted-foreground cursor-not-allowed"
                title="Requis pour les mots de passe"
              >
                := (Affecter)
              </div>
            ) : (
              <Select
                value={row.op}
                onValueChange={(val) => updateRow(i, 'op', val ?? ':=')}
              >
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ops.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Value */}
            <Input
              className="flex-1 min-w-0"
              placeholder="Valeur"
              value={row.value}
              onChange={(e) => updateRow(i, 'value', e.target.value)}
            />

            {/* Delete */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-destructive hover:text-destructive"
              onClick={() => removeRow(i)}
              aria-label="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}

      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="h-4 w-4 mr-2" />
        Ajouter un attribut
      </Button>
    </div>
  );
}
