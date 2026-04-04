'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getUserEffectivePolicy } from '@/lib/radius-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeftIcon } from 'lucide-react';
import type { EffectivePolicyRow } from '@/types/radius';

function SourceBadge({ source }: { source: string }) {
  if (source === 'user') {
    return (
      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-0">
        Utilisateur
      </Badge>
    );
  }
  const groupName = source.replace('group:', '');
  return (
    <Badge variant="secondary">
      Groupe : {groupName}
    </Badge>
  );
}

function PolicyTable({ rows, title }: { rows: EffectivePolicyRow[]; title: string }) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Attribut</TableHead>
              <TableHead className="w-16">Op.</TableHead>
              <TableHead>Valeur</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={idx}>
                <TableCell className="font-mono text-xs">{row.attribute}</TableCell>
                <TableCell className="text-muted-foreground">{row.op}</TableCell>
                <TableCell className="font-mono text-xs">{row.value}</TableCell>
                <TableCell>
                  <SourceBadge source={row.source} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function EffectivePolicyPage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['effective-policy', username],
    queryFn: () => getUserEffectivePolicy(username),
  });

  const checkRows = rows.filter((r) => r.table === 'check');
  const replyRows = rows.filter((r) => r.table === 'reply');

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" render={<Link href={`/users/${encodeURIComponent(username)}`} />}>
          <ArrowLeftIcon />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Politique effective</h1>
          <p className="text-sm text-muted-foreground">{username}</p>
        </div>
      </div>

      {/* Explanatory note */}
      <p className="text-sm text-muted-foreground rounded-lg border border-border bg-muted/30 px-4 py-3">
        Cette vue montre la politique résultante après fusion des attributs utilisateur et groupe,
        par ordre de priorité.
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 bg-muted rounded animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun attribut défini pour cet utilisateur.</p>
      ) : (
        <div className="space-y-6">
          <PolicyTable rows={checkRows} title="Attributs de vérification" />
          <PolicyTable rows={replyRows} title="Attributs de réponse" />
        </div>
      )}
    </div>
  );
}
