'use client';
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, type ColumnDef } from '@/components/radius/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getPostAuthLogs } from '@/lib/logs-api';
import { formatDate } from '@/lib/format';
import type { PostAuthRecord } from '@/types/dashboard';

const PAGE_SIZE = 20;

function ReplyBadge({ reply }: { reply: string }) {
  const isAccept = reply.toLowerCase().includes('accept');
  if (isAccept) {
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0 text-xs">
        Accepté
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-0 text-xs">
      Rejeté
    </Badge>
  );
}

export default function PostAuthLogsPage() {
  // ── Filter state ─────────────────────────────────────────────────────────
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const [activeFilters, setActiveFilters] = useState({
    username: '',
    status: '',
    date_from: '',
    date_to: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['logs', 'postauth', activeFilters, page],
    queryFn: () =>
      getPostAuthLogs({ ...activeFilters, page, page_size: PAGE_SIZE }),
  });

  const handleSearch = useCallback(() => {
    setPage(1);
    setActiveFilters({
      username,
      status,
      date_from: dateFrom,
      date_to: dateTo,
    });
  }, [username, status, dateFrom, dateTo]);

  const handlePageChange = useCallback((p: number) => setPage(p), []);

  // ── Column definitions ────────────────────────────────────────────────────
  const columns: ColumnDef<PostAuthRecord>[] = [
    {
      key: 'username',
      header: 'Utilisateur',
      render: (row) => <span className="font-medium">{row.username}</span>,
    },
    {
      key: 'reply',
      header: 'Résultat',
      render: (row) => <ReplyBadge reply={row.reply} />,
    },
    {
      key: 'authdate',
      header: 'Date',
      render: (row) => formatDate(row.authdate),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Journaux post-authentification
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Historique des tentatives d&apos;authentification RADIUS
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-md border border-border bg-card p-4 space-y-4">
        <h2 className="text-sm font-semibold">Filtres</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="filter-username">Utilisateur</Label>
            <Input
              id="filter-username"
              placeholder="Filtrer par utilisateur"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-status">Statut</Label>
            <select
              id="filter-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <option value="">Tous</option>
              <option value="accept">Accepté</option>
              <option value="reject">Rejeté</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-date-from">Du</Label>
            <Input
              id="filter-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-date-to">Au</Label>
            <Input
              id="filter-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
        <Button onClick={handleSearch} size="sm">
          Rechercher
        </Button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={handlePageChange}
        onSearch={() => {}}
        searchPlaceholder="Rechercher..."
        emptyMessage="Aucun enregistrement d'authentification trouvé"
        isLoading={isLoading}
        rowKey={(row) => row.id}
      />
    </div>
  );
}
