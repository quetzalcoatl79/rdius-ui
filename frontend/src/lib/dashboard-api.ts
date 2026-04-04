import { apiFetch } from '@/lib/api';
import type {
  DashboardMetrics,
  AuthRateBucket,
  TrafficPerNas,
  TopUser,
  TimeRange,
} from '@/types/dashboard';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== '') q.set(key, String(val));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Dashboard API ────────────────────────────────────────────────────────────

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const res = await apiFetch('/dashboard/metrics');
  return parseJson<DashboardMetrics>(res);
}

export async function getAuthRates(range: TimeRange = '24h'): Promise<AuthRateBucket[]> {
  const qs = buildQuery({ range });
  const res = await apiFetch(`/dashboard/auth-rates${qs}`);
  return parseJson<AuthRateBucket[]>(res);
}

export async function getTrafficPerNas(): Promise<TrafficPerNas[]> {
  const res = await apiFetch('/dashboard/traffic-per-nas');
  return parseJson<TrafficPerNas[]>(res);
}

export async function getTopUsers(
  by: 'traffic' | 'time' = 'traffic',
  limit: number = 10
): Promise<TopUser[]> {
  const qs = buildQuery({ by, limit });
  const res = await apiFetch(`/dashboard/top-users${qs}`);
  return parseJson<TopUser[]>(res);
}
