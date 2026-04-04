import { apiFetch } from '@/lib/api';
import type { AccountingRecord, ActiveSession, PostAuthRecord } from '@/types/dashboard';
import type { PaginatedResponse } from '@/types/radius';

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

// ─── Logs API ─────────────────────────────────────────────────────────────────

export async function getAccountingLogs(params: {
  username?: string;
  nas_ip?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
} = {}): Promise<PaginatedResponse<AccountingRecord>> {
  const qs = buildQuery({
    username: params.username,
    nas_ip: params.nas_ip,
    date_from: params.date_from,
    date_to: params.date_to,
    page: params.page,
    page_size: params.page_size,
  });
  const res = await apiFetch(`/logs/accounting${qs}`);
  return parseJson<PaginatedResponse<AccountingRecord>>(res);
}

export async function getActiveSessions(params: {
  page?: number;
  page_size?: number;
} = {}): Promise<PaginatedResponse<ActiveSession>> {
  const qs = buildQuery({ page: params.page, page_size: params.page_size });
  const res = await apiFetch(`/logs/sessions${qs}`);
  return parseJson<PaginatedResponse<ActiveSession>>(res);
}

export async function getPostAuthLogs(params: {
  username?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
} = {}): Promise<PaginatedResponse<PostAuthRecord>> {
  const qs = buildQuery({
    username: params.username,
    status: params.status,
    date_from: params.date_from,
    date_to: params.date_to,
    page: params.page,
    page_size: params.page_size,
  });
  const res = await apiFetch(`/logs/postauth${qs}`);
  return parseJson<PaginatedResponse<PostAuthRecord>>(res);
}
