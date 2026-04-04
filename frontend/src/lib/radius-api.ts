import { apiFetch } from '@/lib/api';
import type {
  RadUser,
  RadGroup,
  RadUserGroupMember,
  Nas,
  NasMutationResponse,
  NasCreate,
  NasUpdate,
  PaginatedResponse,
  AttrRow,
  AuthHistoryRow,
  SessionRow,
  EffectivePolicyRow,
} from '@/types/radius';

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

// ─── Users ─────────────────────────────────────────────────────────────────

export async function listUsers(params: {
  search?: string;
  page?: number;
  page_size?: number;
} = {}): Promise<PaginatedResponse<RadUser>> {
  const qs = buildQuery({ search: params.search, page: params.page, page_size: params.page_size });
  const res = await apiFetch(`/radius/users${qs}`);
  return parseJson<PaginatedResponse<RadUser>>(res);
}

export async function getUser(username: string): Promise<RadUser> {
  const res = await apiFetch(`/radius/users/${encodeURIComponent(username)}`);
  return parseJson<RadUser>(res);
}

export async function createUser(data: {
  username: string;
  password: string;
  reply_attrs?: Omit<AttrRow, never>[];
}): Promise<RadUser> {
  const res = await apiFetch('/radius/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return parseJson<RadUser>(res);
}

export async function updateUser(
  username: string,
  data: {
    check_attrs?: AttrRow[];
    reply_attrs?: AttrRow[];
  }
): Promise<RadUser> {
  const res = await apiFetch(`/radius/users/${encodeURIComponent(username)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return parseJson<RadUser>(res);
}

export async function deleteUser(username: string): Promise<void> {
  const res = await apiFetch(`/radius/users/${encodeURIComponent(username)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text}`);
  }
}

export async function disableUser(username: string): Promise<RadUser> {
  const res = await apiFetch(`/radius/users/${encodeURIComponent(username)}/disable`, {
    method: 'POST',
  });
  return parseJson<RadUser>(res);
}

export async function enableUser(username: string): Promise<RadUser> {
  const res = await apiFetch(`/radius/users/${encodeURIComponent(username)}/enable`, {
    method: 'POST',
  });
  return parseJson<RadUser>(res);
}

export async function getUserAuthHistory(
  username: string,
  params: { page?: number; page_size?: number } = {}
): Promise<PaginatedResponse<AuthHistoryRow>> {
  const qs = buildQuery({ page: params.page, page_size: params.page_size });
  const res = await apiFetch(
    `/radius/users/${encodeURIComponent(username)}/auth-history${qs}`
  );
  return parseJson<PaginatedResponse<AuthHistoryRow>>(res);
}

export async function getUserSessions(
  username: string,
  params: { page?: number; page_size?: number } = {}
): Promise<PaginatedResponse<SessionRow>> {
  const qs = buildQuery({ page: params.page, page_size: params.page_size });
  const res = await apiFetch(
    `/radius/users/${encodeURIComponent(username)}/sessions${qs}`
  );
  return parseJson<PaginatedResponse<SessionRow>>(res);
}

export async function getUserEffectivePolicy(
  username: string
): Promise<EffectivePolicyRow[]> {
  const res = await apiFetch(
    `/radius/users/${encodeURIComponent(username)}/effective-policy`
  );
  return parseJson<EffectivePolicyRow[]>(res);
}

export async function getGroupMembers(groupname: string): Promise<RadUserGroupMember[]> {
  const res = await apiFetch(
    `/radius/groups/${encodeURIComponent(groupname)}/members`
  );
  return parseJson<RadUserGroupMember[]>(res);
}

// ─── Groups ────────────────────────────────────────────────────────────────

export async function listGroups(params: {
  search?: string;
  page?: number;
  page_size?: number;
} = {}): Promise<PaginatedResponse<RadGroup>> {
  const qs = buildQuery({ search: params.search, page: params.page, page_size: params.page_size });
  const res = await apiFetch(`/radius/groups${qs}`);
  return parseJson<PaginatedResponse<RadGroup>>(res);
}

export async function getGroup(groupname: string): Promise<RadGroup> {
  const res = await apiFetch(`/radius/groups/${encodeURIComponent(groupname)}`);
  return parseJson<RadGroup>(res);
}

export async function createGroup(data: {
  groupname: string;
  check_attrs?: AttrRow[];
  reply_attrs?: AttrRow[];
}): Promise<RadGroup> {
  const res = await apiFetch('/radius/groups', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return parseJson<RadGroup>(res);
}

export async function updateGroup(
  groupname: string,
  data: {
    check_attrs?: AttrRow[];
    reply_attrs?: AttrRow[];
  }
): Promise<RadGroup> {
  const res = await apiFetch(`/radius/groups/${encodeURIComponent(groupname)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return parseJson<RadGroup>(res);
}

export async function deleteGroup(groupname: string): Promise<void> {
  const res = await apiFetch(`/radius/groups/${encodeURIComponent(groupname)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text}`);
  }
}

export async function assignUserToGroup(
  groupname: string,
  data: { username: string; priority?: number }
): Promise<RadUserGroupMember> {
  const res = await apiFetch(`/radius/groups/${encodeURIComponent(groupname)}/members`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return parseJson<RadUserGroupMember>(res);
}

export async function removeUserFromGroup(
  groupname: string,
  username: string
): Promise<void> {
  const res = await apiFetch(
    `/radius/groups/${encodeURIComponent(groupname)}/members/${encodeURIComponent(username)}`,
    { method: 'DELETE' }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text}`);
  }
}

// ─── NAS ───────────────────────────────────────────────────────────────────

export async function listNas(params: {
  search?: string;
  page?: number;
  page_size?: number;
} = {}): Promise<PaginatedResponse<Nas>> {
  const qs = buildQuery({ search: params.search, page: params.page, page_size: params.page_size });
  const res = await apiFetch(`/nas${qs}`);
  return parseJson<PaginatedResponse<Nas>>(res);
}

export async function getNas(id: number): Promise<Nas> {
  const res = await apiFetch(`/nas/${id}`);
  return parseJson<Nas>(res);
}

export async function createNas(data: NasCreate): Promise<NasMutationResponse> {
  const res = await apiFetch('/nas', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return parseJson<NasMutationResponse>(res);
}

export async function updateNas(id: number, data: NasUpdate): Promise<NasMutationResponse> {
  const res = await apiFetch(`/nas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return parseJson<NasMutationResponse>(res);
}

export async function deleteNas(id: number): Promise<void> {
  const res = await apiFetch(`/nas/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text}`);
  }
}

export async function getNasSecret(id: number): Promise<{ secret: string }> {
  const res = await apiFetch(`/nas/${id}/secret`);
  return parseJson<{ secret: string }>(res);
}
