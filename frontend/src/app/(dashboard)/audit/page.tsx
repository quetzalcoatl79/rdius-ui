'use client';
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DataTable, type ColumnDef } from '@/components/radius/DataTable';
import { getAuditLogs, type AuditLogEntry } from '@/lib/audit-api';
import { formatDate } from '@/lib/format';

const PAGE_SIZE = 20;

// ─── Action badge ─────────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: string }) {
  const config: Record<string, { className: string }> = {
    create: { className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0 text-xs' },
    update: { className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-0 text-xs' },
    delete: { className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-0 text-xs' },
    restart: { className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-0 text-xs' },
  };
  const lower = action.toLowerCase();
  const cls = config[lower]?.className ?? 'bg-muted text-muted-foreground border-0 text-xs';
  return <Badge className={cls}>{action}</Badge>;
}

// ─── Details cell ─────────────────────────────────────────────────────────────

function DetailsCell({ details }: { details: Record<string, unknown> | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!details) return <span className="text-muted-foreground/50">—</span>;
  const str = JSON.stringify(details);
  const short = str.length > 100 ? str.slice(0, 100) + '...' : str;
  return (
    <span
      className="font-mono text-xs cursor-pointer hover:text-foreground text-muted-foreground"
      onClick={() => setExpanded((v) => !v)}
      title="Cliquer pour développer"
    >
      {expanded ? str : short}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const { user } = useAuth();

  // Filter input state
  const [userEmail, setUserEmail] = useState('');
  const [action, setAction] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  // Active filters applied on search button click
  const [activeFilters, setActiveFilters] = useState({
    user_email: '',
    action: '',
    resource_type: '',
    date_from: '',
    date_to: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['audit', activeFilters, page],
    queryFn: () => getAuditLogs({ ...activeFilters, page, page_size: PAGE_SIZE }),
  });

  const handleSearch = useCallback(() => {
    setPage(1);
    setActiveFilters({
      user_email: userEmail,
      action,
      resource_type: resourceType,
      date_from: dateFrom,
      date_to: dateTo,
    });
  }, [userEmail, action, resourceType, dateFrom, dateTo]);

  const handleReset = useCallback(() => {
    setUserEmail('');
    setAction('');
    setResourceType('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
    setActiveFilters({
      user_email: '',
      action: '',
      resource_type: '',
      date_from: '',
      date_to: '',
    });
  }, []);

  const handlePageChange = useCallback((p: number) => setPage(p), []);

  // Role guard
  if (user && user.role !== 'admin' && user.role !== 'super_admin') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Journal d&apos;audit</h1>
        <p className="text-muted-foreground">Accès réservé aux administrateurs.</p>
      </div>
    );
  }

  // ── Column definitions ──────────────────────────────────────────────────────

  const columns: ColumnDef<AuditLogEntry>[] = [
    {
      key: 'created_at',
      header: 'Date',
      render: (row) => (
        <span className="whitespace-nowrap text-sm">{formatDate(row.created_at)}</span>
      ),
    },
    {
      key: 'user_email',
      header: 'Utilisateur',
      render: (row) => (
        <span className="text-sm font-medium">{row.user_email}</span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => <ActionBadge action={row.action} />,
    },
    {
      key: 'resource_type',
      header: 'Ressource',
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.resource_type}
          {row.resource_id ? <span className="ml-1 font-mono text-xs">#{row.resource_id.slice(0, 8)}</span> : null}
        </span>
      ),
    },
    {
      key: 'details',
      header: 'Détails',
      render: (row) => <DetailsCell details={row.details} />,
    },
    {
      key: 'ip_address',
      header: 'Adresse IP',
      render: (row) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.ip_address ?? '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Journal d&apos;audit</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Historique de toutes les actions administratives
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-md border border-border bg-card p-4 space-y-4">
        <h2 className="text-sm font-semibold">Filtres</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="filter-email">Utilisateur</Label>
            <Input
              id="filter-email"
              placeholder="Filtrer par email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-action">Action</Label>
            <select
              id="filter-action"
              className="w-full px-3 py-2 rounded-md bg-background text-sm border border-input focus:outline-none focus:ring-2 focus:ring-ring"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <option value="">Toutes les actions</option>
              <option value="create">create</option>
              <option value="update">update</option>
              <option value="delete">delete</option>
              <option value="restart">restart</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-resource">Type de ressource</Label>
            <select
              id="filter-resource"
              className="w-full px-3 py-2 rounded-md bg-background text-sm border border-input focus:outline-none focus:ring-2 focus:ring-ring"
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value)}
            >
              <option value="">Tous les types</option>
              <option value="server">server</option>
              <option value="radius_user">radius_user</option>
              <option value="group">group</option>
              <option value="nas">nas</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-date-from">Date de début</Label>
            <Input
              id="filter-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-date-to">Date de fin</Label>
            <Input
              id="filter-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSearch} size="sm">
            Rechercher
          </Button>
          <Button onClick={handleReset} variant="outline" size="sm">
            Réinitialiser
          </Button>
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
        emptyMessage="Aucune entrée dans le journal d'audit"
        isLoading={isLoading}
        rowKey={(row) => row.id}
      />
    </div>
  );
}
