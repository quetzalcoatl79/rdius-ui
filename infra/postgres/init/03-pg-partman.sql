-- ──────────────────────────────────────────────────────────────────────────────
-- 03-pg-partman.sql — Enable pg_partman and configure radacct monthly partitioning
-- Requires: postgresql-16-partman installed in the postgres Docker image
--           (see infra/postgres/Dockerfile)
-- ──────────────────────────────────────────────────────────────────────────────

-- Install pg_partman extension into the partman schema
CREATE EXTENSION IF NOT EXISTS pg_partman SCHEMA partman;

-- Create monthly partitions for radius.radacct
-- p_parent_table: the partitioned parent table
-- p_control:      partition key column (AcctStartTime)
-- p_interval:     'monthly' — one partition per month
-- p_start_partition: start from the current month
SELECT partman.create_parent(
    p_parent_table    => 'radius.radacct',
    p_control         => 'AcctStartTime',
    p_interval        => 'monthly',
    p_start_partition => to_char(NOW(), 'YYYY-MM-01')
);

-- Configure partition maintenance:
-- infinite_time_partitions: keep creating future partitions indefinitely
-- retention:                keep 12 months of data (older partitions are dropped)
-- retention_keep_table:     keep the physical table even after retention period
--                           (allows manual archiving before permanent deletion)
-- premake:                  create 3 months of future partitions in advance
UPDATE partman.part_config
SET
    infinite_time_partitions = TRUE,
    retention                = '12 months',
    retention_keep_table     = TRUE,
    premake                  = 3
WHERE parent_table = 'radius.radacct';

-- Verify the partition config was created
-- This SELECT will appear in the container init logs — confirms partman is working
SELECT
    parent_table,
    control,
    partition_interval,
    retention,
    premake
FROM partman.part_config
WHERE parent_table = 'radius.radacct';
