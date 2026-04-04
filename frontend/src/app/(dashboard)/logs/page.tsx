'use client';
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, type ColumnDef } from '@/components/radius/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getAccountingLogs } from '@/lib/logs-api';
import { formatDuration, formatBytes, formatDate } from '@/lib/format';
import type { AccountingRecord } from '@/types/dashboard';

const PAGE_SIZE = 20;

export default function AccountingLogsPage() {
  // ── Filter state ─────────────────────────────────────────────────────────
  const [username, setUsername] = useState('');
  const [nasIp, setNasIp] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  // Active filters applied to query (only applied on Rechercher click)
  const [activeFilters, setActiveFilters] = useState({
    username: '',
    nas_ip: '',
    date_from: '',
    date_to: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['logs', 'accounting', activeFilters, page],
    queryFn: () =>
      getAccountingLogs({ ...activeFilters, page, page_size: PAGE_SIZE }),
  });

  const handleSearch = useCallback(() => {
    setPage(1);
    setActiveFilters({
      username,
      nas_ip: nasIp,
      date_from: dateFrom,
      date_to: dateTo,
    });
  }, [username, nasIp, dateFrom, dateTo]);

  const handlePageChange = useCallback((p: number) => setPage(p), []);

  // ── Column definitions ────────────────────────────────────────────────────
  const columns: ColumnDef<AccountingRecord>[] = [
    {
      key: 'username',
      header: 'Utilisateur',
      render: (row) => <span className="font-medium">{row.username}</span>,
    },
    {
      key: 'nas_ip_address',
      header: 'NAS',
      render: (row) => row.nas_ip_address,
    },
    {
      key: 'framedipaddress',
      header: 'IP',
      render: (row) => row.framedipaddress ?? '-',
    },
    {
      key: 'acct_start_time',
      header: 'Début',
      render: (row) => formatDate(row.acct_start_time),
    },
    {
      key: 'acct_stop_time',
      header: 'Fin',
      render: (row) =>
        row.acct_stop_time ? (
          formatDate(row.acct_stop_time)
        ) : (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0 text-xs">
            En cours
          </Badge>
        ),
    },
    {
      key: 'acct_session_time',
      header: 'Durée',
      render: (row) => formatDuration(row.acct_session_time),
    },
    {
      key: 'acct_input_octets',
      header: 'Entrant',
      render: (row) => formatBytes(row.acct_input_octets),
    },
    {
      key: 'acct_output_octets',
      header: 'Sortant',
      render: (row) => formatBytes(row.acct_output_octets),
    },
    {
      key: 'terminate_cause',
      header: 'Cause',
      render: (row) => row.terminate_cause ?? '-',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Comptabilité RADIUS</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Historique complet des sessions d&apos;accès réseau
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
            <Label htmlFor="filter-nas">NAS</Label>
            <Input
              id="filter-nas"
              placeholder="Filtrer par NAS"
              value={nasIp}
              onChange={(e) => setNasIp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
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
        emptyMessage="Aucun enregistrement de comptabilité trouvé"
        isLoading={isLoading}
        rowKey={(row) => row.radacctid}
      />
    </div>
  );
}
