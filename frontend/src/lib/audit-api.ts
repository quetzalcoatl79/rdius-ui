import { apiFetch } from '@/lib/api';
import type { PaginatedResponse } from '@/types/radius';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogFilter {
  user_email?: string;
  action?: string;
  resource_type?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

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

// ─── Audit API ─────────────────────────────────────────────────────────────

export async function getAuditLogs(
  params: AuditLogFilter = {}
): Promise<PaginatedResponse<AuditLogEntry>> {
  const qs = buildQuery({
    user_email: params.user_email,
    action: params.action,
    resource_type: params.resource_type,
    date_from: params.date_from,
    date_to: params.date_to,
    page: params.page,
    page_size: params.page_size,
  });
  const res = await apiFetch(`/audit${qs}`);
  return parseJson<PaginatedResponse<AuditLogEntry>>(res);
}
