import { apiFetch } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────

export type ServerType = 'docker' | 'remote';

export interface ServerResponse {
  id: string;
  name: string;
  server_type: ServerType;
  docker_container_id: string | null;
  remote_host: string | null;
  remote_port: number;
  remote_user: string | null;
  remote_restart_cmd: string | null;
  remote_status_cmd: string | null;
  cluster: string | null;
  role: string | null;
  capacity: number | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServerCreate {
  name: string;
  server_type: ServerType;
  docker_container_id?: string | null;
  remote_host?: string | null;
  remote_port?: number;
  remote_user?: string | null;
  remote_restart_cmd?: string | null;
  remote_status_cmd?: string | null;
  description?: string | null;
}

export interface ServerUpdate {
  name?: string;
  server_type?: ServerType;
  docker_container_id?: string | null;
  remote_host?: string | null;
  remote_port?: number;
  remote_user?: string | null;
  remote_restart_cmd?: string | null;
  remote_status_cmd?: string | null;
  description?: string | null;
  is_active?: boolean;
}

export interface ServerStatus {
  server_id: string;
  container_status: 'running' | 'stopped' | 'restarting' | 'not_found' | 'not_configured' | 'unknown';
  uptime_seconds: number | null;
  started_at: string | null;
  last_restart: string | null;
}

export interface ServerHealth {
  server_id: string;
  cpu_percent: number;
  memory_usage_mb: number;
  memory_limit_mb: number;
  memory_percent: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Server CRUD ───────────────────────────────────────────────────────────

export async function getServers(): Promise<ServerResponse[]> {
  const res = await apiFetch('/servers');
  return parseJson<ServerResponse[]>(res);
}

export async function getServer(id: string): Promise<ServerResponse> {
  const res = await apiFetch(`/servers/${id}`);
  return parseJson<ServerResponse>(res);
}

export async function createServer(data: ServerCreate): Promise<ServerResponse> {
  const res = await apiFetch('/servers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return parseJson<ServerResponse>(res);
}

export async function updateServer(id: string, data: ServerUpdate): Promise<ServerResponse> {
  const res = await apiFetch(`/servers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return parseJson<ServerResponse>(res);
}

export async function deleteServer(id: string): Promise<void> {
  const res = await apiFetch(`/servers/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text}`);
  }
}

export async function restartServer(id: string): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch(`/servers/${id}/restart`, { method: 'POST' });
  return parseJson<{ success: boolean; message: string }>(res);
}

export async function getServerStatus(id: string): Promise<ServerStatus> {
  const res = await apiFetch(`/servers/${id}/status`);
  return parseJson<ServerStatus>(res);
}

export async function getServerHealth(id: string): Promise<ServerHealth> {
  const res = await apiFetch(`/servers/${id}/health`);
  return parseJson<ServerHealth>(res);
}
