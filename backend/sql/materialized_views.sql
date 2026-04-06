-- Materialized views for dashboard metrics pre-aggregation (DASH-06)
-- Run this against PostgreSQL after the main schema is initialized.
-- These views are refreshed every 60 seconds by the background task in main.py.
--
-- NOTE: Column names are unquoted (lowercase) because PostgreSQL stores
-- unquoted identifiers in lowercase regardless of CREATE TABLE casing.

-- Auth rates: hourly buckets of success/failure counts from radpostauth
CREATE MATERIALIZED VIEW IF NOT EXISTS radius.mv_auth_rates AS
SELECT
  date_trunc('hour', authdate) AS bucket,
  COUNT(*) FILTER (WHERE reply = 'Access-Accept') AS success,
  COUNT(*) FILTER (WHERE reply = 'Access-Reject') AS failure
FROM radius.radpostauth
WHERE authdate >= NOW() - INTERVAL '30 days'
GROUP BY date_trunc('hour', authdate)
ORDER BY bucket;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_auth_rates_bucket ON radius.mv_auth_rates (bucket);

-- Traffic per NAS: total bytes in/out per NAS from radacct
CREATE MATERIALIZED VIEW IF NOT EXISTS radius.mv_traffic_per_nas AS
SELECT
  ra.nasipaddress AS nas_ip,
  n.shortname,
  COALESCE(SUM(ra.acctinputoctets), 0) AS bytes_in,
  COALESCE(SUM(ra.acctoutputoctets), 0) AS bytes_out
FROM radius.radacct ra
LEFT JOIN radius.nas n ON host(n.nasname::inet) = host(ra.nasipaddress)
WHERE ra.acctstarttime >= NOW() - INTERVAL '30 days'
GROUP BY ra.nasipaddress, n.shortname;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_traffic_nas_ip ON radius.mv_traffic_per_nas (nas_ip);

-- Top users: total bytes + session time per user from radacct
CREATE MATERIALIZED VIEW IF NOT EXISTS radius.mv_top_users AS
SELECT
  ra.username AS username,
  COALESCE(SUM(ra.acctinputoctets), 0) + COALESCE(SUM(ra.acctoutputoctets), 0) AS total_bytes,
  COALESCE(SUM(ra.acctsessiontime), 0) AS total_session_time
FROM radius.radacct ra
WHERE ra.acctstarttime >= NOW() - INTERVAL '30 days'
GROUP BY ra.username;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_top_users_username ON radius.mv_top_users (username);
