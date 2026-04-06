'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Users, Activity, Server, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  getDashboardMetrics,
  getAuthRates,
  getTrafficPerNas,
  getTopUsers,
} from '@/lib/dashboard-api';
import { formatDuration, formatBytes } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { TimeRange } from '@/types/dashboard';

// ---- Date formatters ----

function makeFmt(locale: string) {
  return {
    time: new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }),
    date: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }),
  };
}

function formatBucket(bucket: string, range: TimeRange, locale: string): string {
  const d = new Date(bucket);
  const fmt = makeFmt(locale);
  if (range === '1h' || range === '24h') return fmt.time.format(d);
  return fmt.date.format(d);
}

// ---- Time range options ----

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '1h', label: '1h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
];

// ---- Skeleton card ----

function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
        <div className="h-4 w-4 bg-muted rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-16 bg-muted rounded animate-pulse mb-1" />
        <div className="h-3 w-32 bg-muted rounded animate-pulse" />
      </CardContent>
    </Card>
  );
}

// ---- Metric card ----

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  accent,
}: {
  title: string;
  value: number;
  description: string;
  icon: typeof Users;
  accent: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute inset-0 opacity-5 ${accent}`} />
      <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`p-2 rounded-lg ${accent} bg-opacity-10`}>
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="relative">
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

// ---- Dashboard page ----

export default function DashboardPage() {
  const { resolvedTheme } = useTheme();
  const { t, locale } = useI18n();
  const isDark = resolvedTheme === 'dark';

  const [range, setRange] = useState<TimeRange>('24h');
  const [topUsersBy, setTopUsersBy] = useState<'traffic' | 'time'>('traffic');

  // Data queries
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: getDashboardMetrics,
    refetchInterval: 60_000,
  });

  const { data: authRates, isLoading: authRatesLoading } = useQuery({
    queryKey: ['dashboard', 'auth-rates', range],
    queryFn: () => getAuthRates(range),
    refetchInterval: 60_000,
  });

  const { data: trafficPerNas, isLoading: trafficLoading } = useQuery({
    queryKey: ['dashboard', 'traffic-per-nas'],
    queryFn: getTrafficPerNas,
    refetchInterval: 60_000,
  });

  const { data: topUsers, isLoading: topUsersLoading } = useQuery({
    queryKey: ['dashboard', 'top-users', topUsersBy],
    queryFn: () => getTopUsers(topUsersBy, 10),
    refetchInterval: 60_000,
  });

  // Chart colors
  const axisColor = isDark ? '#9ca3af' : '#6b7280';
  const gridColor = isDark ? '#374151' : '#e5e7eb';
  const tooltipStyle = {
    backgroundColor: isDark ? '#1e1b4b' : '#ffffff',
    border: `1px solid ${isDark ? '#312e81' : '#e0e7ff'}`,
    borderRadius: '8px',
    color: isDark ? '#e0e7ff' : '#312e81',
  };

  // Auth rates chart data
  const authChartData = (authRates ?? []).map((b) => ({
    ...b,
    label: formatBucket(b.bucket, range, locale),
  }));

  // Traffic per NAS chart data
  const nasChartData = (trafficPerNas ?? []).map((n) => ({
    ...n,
    name: n.shortname ?? n.nas_ip,
  }));

  const handleRangeChange = useCallback((r: TimeRange) => setRange(r), []);

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('dashboard.subtitle')}
        </p>
      </div>

      {/* ---- Metric cards ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricsLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <MetricCard
              title={t('dashboard.users')}
              value={metrics?.total_users ?? 0}
              description={t('dashboard.usersDesc')}
              icon={Users}
              accent="bg-blue-500"
            />
            <MetricCard
              title={t('dashboard.activeSessions')}
              value={metrics?.active_sessions ?? 0}
              description={t('dashboard.activeSessionsDesc')}
              icon={Activity}
              accent="bg-emerald-500"
            />
            <MetricCard
              title={t('dashboard.nasEquipment')}
              value={metrics?.nas_count ?? 0}
              description={t('dashboard.nasEquipmentDesc')}
              icon={Server}
              accent="bg-violet-500"
            />
            <MetricCard
              title={t('dashboard.recentFailures')}
              value={metrics?.recent_auth_failures ?? 0}
              description={t('dashboard.recentFailuresDesc')}
              icon={ShieldAlert}
              accent="bg-red-500"
            />
          </>
        )}
      </div>

      {/* ---- Auth rates chart ---- */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{t('dashboard.authRates')}</CardTitle>
            <div className="flex items-center gap-1">
              {TIME_RANGES.map(({ value, label }) => (
                <Button
                  key={value}
                  variant={range === value ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => handleRangeChange(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {authRatesLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : authChartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              {t('dashboard.noData')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart
                data={authChartData}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="failureGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: axisColor, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: axisColor, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend
                  formatter={(value: string) =>
                    value === 'success' ? t('dashboard.success') : t('dashboard.failures')
                  }
                />
                <Area
                  type="monotone"
                  dataKey="success"
                  name="success"
                  stroke="#22c55e"
                  fill="url(#successGrad)"
                  strokeWidth={2}
                  stackId="1"
                />
                <Area
                  type="monotone"
                  dataKey="failure"
                  name="failure"
                  stroke="#ef4444"
                  fill="url(#failureGrad)"
                  strokeWidth={2}
                  stackId="1"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ---- Traffic per NAS + Top users ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Traffic per NAS */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.trafficPerNas')}</CardTitle>
          </CardHeader>
          <CardContent>
            {trafficLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : nasChartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                {t('dashboard.noData')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={nasChartData}
                  layout="vertical"
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={gridColor}
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(v: number) => formatBytes(v)}
                    tick={{ fill: axisColor, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={90}
                    tick={{ fill: axisColor, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [
                      formatBytes(typeof value === 'number' ? value : 0),
                    ]}
                  />
                  <Legend
                    formatter={(value: string) =>
                      value === 'bytes_in' ? t('dashboard.incoming') : t('dashboard.outgoing')
                    }
                  />
                  <Bar
                    dataKey="bytes_in"
                    name="bytes_in"
                    fill="#6366f1"
                    radius={[0, 4, 4, 0]}
                  />
                  <Bar
                    dataKey="bytes_out"
                    name="bytes_out"
                    fill="#f59e0b"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top users table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>{t('dashboard.topUsers')}</CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant={topUsersBy === 'traffic' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setTopUsersBy('traffic')}
                >
                  {t('dashboard.byTraffic')}
                </Button>
                <Button
                  variant={topUsersBy === 'time' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setTopUsersBy('time')}
                >
                  {t('dashboard.byTime')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {topUsersLoading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-8 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : !topUsers || topUsers.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                {t('dashboard.noData')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                        #
                      </th>
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                        {t('dashboard.user')}
                      </th>
                      <th className="text-right py-2 pr-4 font-medium text-muted-foreground">
                        {t('dashboard.totalTraffic')}
                      </th>
                      <th className="text-right py-2 font-medium text-muted-foreground">
                        {t('dashboard.sessionTime')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {topUsers.map((u, idx) => (
                      <tr
                        key={u.username}
                        className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-2 pr-4 text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="py-2 pr-4 font-medium truncate max-w-[140px]">
                          {u.username}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {formatBytes(u.total_bytes)}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatDuration(u.total_session_time)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
