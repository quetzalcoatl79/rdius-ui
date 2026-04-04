'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getUserAuthHistory } from '@/lib/radius-api';
import { DataTable, type ColumnDef } from '@/components/radius/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeftIcon } from 'lucide-react';
import type { AuthHistoryRow } from '@/types/radius';

const PAGE_SIZE = 20;

const formatDate = (dateStr: string): string =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'medium' }).format(
    new Date(dateStr)
  );

type StatusFilter = 'all' | 'accept' | 'reject';

export default function AuthHistoryPage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username);

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['auth-history', username, page],
    queryFn: () => getUserAuthHistory(username, { page, page_size: PAGE_SIZE }),
  });

  const filteredItems =
    data?.items.filter((row) => {
      if (statusFilter === 'accept') return row.reply === 'Access-Accept';
      if (statusFilter === 'reject') return row.reply === 'Access-Reject';
      return true;
    }) ?? [];

  const columns: ColumnDef<AuthHistoryRow>[] = [
    {
      key: 'authdate',
      header: 'Date',
      render: (row) => formatDate(row.authdate),
    },
    {
      key: 'reply',
      header: 'Statut',
      render: (row) =>
        row.reply === 'Access-Accept' ? (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0">
            Accepté
          </Badge>
        ) : (
          <Badge variant="destructive">Rejeté</Badge>
        ),
    },
    {
      key: 'callingstationid',
      header: 'IP appelant',
      render: (row) => row.callingstationid ?? '—',
    },
    {
      key: 'calledstationid',
      header: 'IP appelé',
      render: (row) => row.calledstationid ?? '—',
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" render={<Link href={`/users/${encodeURIComponent(username)}`} />}>
          <ArrowLeftIcon />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Historique d'authentification</h1>
          <p className="text-sm text-muted-foreground">{username}</p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Statut :</span>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as StatusFilter); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="accept">Accepté</SelectItem>
            <SelectItem value="reject">Rejeté</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredItems}
        total={statusFilter === 'all' ? (data?.total ?? 0) : filteredItems.length}
        page={page}
        pageSize={PAGE_SIZE}
        isLoading={isLoading}
        emptyMessage="Aucun historique disponible pour cet utilisateur"
        onPageChange={setPage}
        onSearch={() => {}}
        rowKey={(row) => row.id}
      />
    </div>
  );
}
