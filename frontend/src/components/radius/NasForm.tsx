'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Nas } from '@/types/radius';

const NAS_TYPES = [
  'other',
  'cisco',
  'motorola',
  'mikrotik',
  'juniper',
  'huawei',
  'ubiquiti',
  'ruckus',
];

export interface NasFormValues {
  nasname: string;
  shortname: string;
  type: string;
  ports: string;
  secret: string;
  server: string;
  community: string;
  description: string;
}

interface NasFormProps {
  nas?: Nas;
  onSubmit: (data: NasFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  isEdit?: boolean;
}

export function NasForm({ nas, onSubmit, onCancel, isSubmitting, isEdit }: NasFormProps) {
  const [values, setValues] = useState<NasFormValues>({
    nasname: nas?.nasname ?? '',
    shortname: nas?.shortname ?? '',
    type: nas?.type ?? 'other',
    ports: nas?.ports !== null && nas?.ports !== undefined ? String(nas.ports) : '',
    secret: '',
    server: nas?.server ?? '',
    community: nas?.community ?? '',
    description: nas?.description ?? '',
  });

  const set = (field: keyof NasFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nasname">
            IP / Nom d&apos;hôte <span className="text-destructive">*</span>
          </Label>
          <Input
            id="nasname"
            placeholder="192.168.1.1 ou nas.example.com"
            value={values.nasname}
            onChange={set('nasname')}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="shortname">Nom court</Label>
          <Input
            id="shortname"
            placeholder="ex: AP-Salle1"
            value={values.shortname}
            onChange={set('shortname')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select
            value={values.type}
            onValueChange={(val) => setValues((v) => ({ ...v, type: val ?? 'other' }))}
          >
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NAS_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ports">Ports</Label>
          <Input
            id="ports"
            type="number"
            placeholder="1812"
            value={values.ports}
            onChange={set('ports')}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="secret">
            Secret partagé {!isEdit && <span className="text-destructive">*</span>}
          </Label>
          <Input
            id="secret"
            type="password"
            placeholder={isEdit ? '•••••••• (laisser vide pour conserver)' : 'Secret partagé'}
            value={values.secret}
            onChange={set('secret')}
            required={!isEdit}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="server">Serveur</Label>
          <Input
            id="server"
            placeholder="Optionnel"
            value={values.server}
            onChange={set('server')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="community">Communauté SNMP</Label>
          <Input
            id="community"
            placeholder="Optionnel"
            value={values.community}
            onChange={set('community')}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            placeholder="Optionnel"
            value={values.description}
            onChange={set('description')}
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Continuer'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
