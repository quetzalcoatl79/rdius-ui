'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getUserSessions } from '@/lib/radius-api';
import { DataTable, type ColumnDef } from '@/components/radius/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeftIcon } from 'lucide-react';
import type { SessionRow } from '@/types/radius';

const PAGE_SIZE = 20;

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds < 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}min`;
  return `${mins}min`;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(1)} ${units[i]}`;
}

const formatDate = (dateStr: string): string =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(dateStr)
  );

export default function SessionsPage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username);

  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['sessions', username, page],
    queryFn: () => getUserSessions(username, { page, page_size: PAGE_SIZE }),
  });

  const columns: ColumnDef<SessionRow>[] = [
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
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0">
            En cours
          </Badge>
        ),
    },
    {
      key: 'duration',
      header: 'Durée',
      render: (row) => formatDuration(row.acct_session_time),
    },
    {
      key: 'nas_ip_address',
      header: 'NAS',
      render: (row) => row.nas_ip_address,
    },
    {
      key: 'acct_input_octets',
      header: 'Données reçues',
      render: (row) => formatBytes(row.acct_input_octets),
    },
    {
      key: 'acct_output_octets',
      header: 'Données envoyées',
      render: (row) => formatBytes(row.acct_output_octets),
    },
    {
      key: 'terminate_cause',
      header: "Cause d'arrêt",
      render: (row) => row.terminate_cause ?? '—',
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" render={<Link href={`/users/${encodeURIComponent(username)}`} />}>
          <ArrowLeftIcon />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Sessions</h1>
          <p className="text-sm text-muted-foreground">{username}</p>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        isLoading={isLoading}
        emptyMessage="Aucune session disponible pour cet utilisateur"
        onPageChange={setPage}
        onSearch={() => {}}
        rowKey={(row) => row.radacctid}
      />
    </div>
  );
}
