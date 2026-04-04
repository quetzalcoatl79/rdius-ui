export interface RadCheckAttr {
  id: number;
  username: string;
  attribute: string;
  op: string;
  value: string;
}

export interface RadReplyAttr {
  id: number;
  username: string;
  attribute: string;
  op: string;
  value: string;
}

export interface RadUser {
  username: string;
  check_attrs: RadCheckAttr[];
  reply_attrs: RadReplyAttr[];
  groups: string[];
  disabled: boolean;
}

export interface RadGroupCheckAttr {
  id: number;
  groupname: string;
  attribute: string;
  op: string;
  value: string;
}

export interface RadGroupReplyAttr {
  id: number;
  groupname: string;
  attribute: string;
  op: string;
  value: string;
}

export interface RadUserGroupMember {
  username: string;
  groupname: string;
  priority: number;
}

export interface RadGroup {
  groupname: string;
  check_attrs: RadGroupCheckAttr[];
  reply_attrs: RadGroupReplyAttr[];
  members: RadUserGroupMember[];
}

export interface Nas {
  id: number;
  nasname: string;
  shortname: string | null;
  type: string;
  ports: number | null;
  secret_masked: string;
  server: string | null;
  community: string | null;
  description: string | null;
}

export interface NasWithSecret extends Nas {
  secret: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface NasMutationResponse extends Nas {
  restart_triggered: boolean;
}

export interface AttrRow {
  attribute: string;
  op: string;
  value: string;
}

export interface NasCreate {
  nasname: string;
  shortname?: string | null;
  type?: string;
  ports?: number | null;
  secret: string;
  server?: string | null;
  community?: string | null;
  description?: string | null;
}

export interface NasUpdate {
  nasname?: string;
  shortname?: string | null;
  type?: string;
  ports?: number | null;
  secret?: string | null;
  server?: string | null;
  community?: string | null;
  description?: string | null;
}

export interface AuthHistoryRow {
  id: number;
  username: string;
  reply: string; // "Access-Accept" | "Access-Reject"
  authdate: string; // ISO datetime
  calledstationid?: string | null;
  callingstationid?: string | null;
}

export interface SessionRow {
  radacctid: number;
  username: string;
  nas_ip_address: string;
  acct_start_time: string;
  acct_stop_time: string | null;
  acct_session_time: number | null; // seconds
  acct_input_octets: number | null;
  acct_output_octets: number | null;
  terminate_cause: string | null;
}

export interface EffectivePolicyRow {
  attribute: string;
  op: string;
  value: string;
  source: string; // "user" | "group:{groupname}"
  table: "check" | "reply";
}

export interface UserCreate {
  username: string;
  password?: string | null;
  check_attrs?: Array<{ attribute: string; op: string; value: string }>;
  reply_attrs?: Array<{ attribute: string; op: string; value: string }>;
}

export interface UserUpdate {
  password?: string | null;
  check_attrs?: Array<{ attribute: string; op: string; value: string }>;
  reply_attrs?: Array<{ attribute: string; op: string; value: string }>;
  disabled?: boolean;
}

export interface GroupCreate {
  groupname: string;
  check_attrs?: Array<{ attribute: string; op: string; value: string }>;
  reply_attrs?: Array<{ attribute: string; op: string; value: string }>;
}

export interface GroupUpdate {
  check_attrs?: Array<{ attribute: string; op: string; value: string }>;
  reply_attrs?: Array<{ attribute: string; op: string; value: string }>;
}
