'use client';
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, type ColumnDef } from '@/components/radius/DataTable';
import { Loader2 } from 'lucide-react';
import { getActiveSessions } from '@/lib/logs-api';
import { formatDuration, formatBytes, formatDate } from '@/lib/format';
import type { ActiveSession } from '@/types/dashboard';

const PAGE_SIZE = 20;

export default function ActiveSessionsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['logs', 'sessions', page],
    queryFn: () => getActiveSessions({ page, page_size: PAGE_SIZE }),
    refetchInterval: 10_000,
  });

  const handlePageChange = useCallback((p: number) => setPage(p), []);

  const columns: ColumnDef<ActiveSession>[] = [
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
  ];

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sessions actives</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Connexions RADIUS en cours
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Actualisation automatique</span>
        </div>
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
        emptyMessage="Aucune session active en ce moment"
        isLoading={isLoading}
        rowKey={(row) => row.radacctid}
      />
    </div>
  );
}
