// ─── Dashboard types ─────────────────────────────────────────────────────────

export interface DashboardMetrics {
  total_users: number;
  active_sessions: number;
  nas_count: number;
  recent_auth_failures: number;
}

export interface AuthRateBucket {
  bucket: string; // ISO datetime
  success: number;
  failure: number;
}

export interface TrafficPerNas {
  nas_ip: string;
  shortname: string | null;
  bytes_in: number;
  bytes_out: number;
}

export interface TopUser {
  username: string;
  total_bytes: number;
  total_session_time: number;
}

export type TimeRange = '1h' | '24h' | '7d' | '30d';

// ─── Log types ────────────────────────────────────────────────────────────────

export interface AccountingRecord {
  radacctid: number;
  username: string;
  nas_ip_address: string;
  framedipaddress: string | null;
  acct_start_time: string | null;
  acct_stop_time: string | null;
  acct_session_time: number | null;
  acct_input_octets: number | null;
  acct_output_octets: number | null;
  terminate_cause: string | null;
}

export interface ActiveSession {
  radacctid: number;
  username: string;
  nas_ip_address: string;
  framedipaddress: string | null;
  acct_start_time: string | null;
  acct_session_time: number | null;
  acct_input_octets: number | null;
  acct_output_octets: number | null;
}

export interface PostAuthRecord {
  id: number;
  username: string;
  reply: string;
  authdate: string | null;
}
