-- ──────────────────────────────────────────────────────────────────────────────
-- 02-radius-schema.sql — FreeRADIUS official table definitions
-- Source: https://github.com/FreeRADIUS/freeradius-server/blob/v3.2.x/raddb/mods-config/sql/main/postgresql/schema.sql
--
-- CRITICAL: PascalCase column names (UserName, not username) are intentional.
-- FreeRADIUS SQL module (rlm_sql) has hardcoded SQL queries that reference these
-- exact column names. Do NOT rename them.
--
-- CRITICAL: These tables must NEVER be touched by Alembic autogenerate.
-- See PITFALLS.md CP-1 for schema ownership conflict prevention.
-- ──────────────────────────────────────────────────────────────────────────────

SET search_path TO radius;

-- ── radcheck — per-user check attributes ──────────────────────────────────────
-- Checked against incoming RADIUS request attributes
-- Default op '==' means "attribute must match this value"
CREATE TABLE IF NOT EXISTS radcheck (
    id        SERIAL PRIMARY KEY,
    UserName  VARCHAR(64)  NOT NULL DEFAULT '',
    Attribute VARCHAR(64)  NOT NULL DEFAULT '',
    op        CHAR(2)      NOT NULL DEFAULT '==',
    Value     VARCHAR(253) NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS radcheck_username ON radcheck (UserName);

-- ── radreply — per-user reply attributes ─────────────────────────────────────
-- Sent back to the NAS in the Access-Accept response
-- Default op '=' means "add to reply if not already present"
CREATE TABLE IF NOT EXISTS radreply (
    id        SERIAL PRIMARY KEY,
    UserName  VARCHAR(64)  NOT NULL DEFAULT '',
    Attribute VARCHAR(64)  NOT NULL DEFAULT '',
    op        CHAR(2)      NOT NULL DEFAULT '=',
    Value     VARCHAR(253) NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS radreply_username ON radreply (UserName);

-- ── radgroupcheck — group-level check attributes ──────────────────────────────
CREATE TABLE IF NOT EXISTS radgroupcheck (
    id        SERIAL PRIMARY KEY,
    GroupName VARCHAR(64)  NOT NULL DEFAULT '',
    Attribute VARCHAR(64)  NOT NULL DEFAULT '',
    op        CHAR(2)      NOT NULL DEFAULT '==',
    Value     VARCHAR(253) NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS radgroupcheck_groupname ON radgroupcheck (GroupName);

-- ── radgroupreply — group-level reply attributes ──────────────────────────────
CREATE TABLE IF NOT EXISTS radgroupreply (
    id        SERIAL PRIMARY KEY,
    GroupName VARCHAR(64)  NOT NULL DEFAULT '',
    Attribute VARCHAR(64)  NOT NULL DEFAULT '',
    op        CHAR(2)      NOT NULL DEFAULT '=',
    Value     VARCHAR(253) NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS radgroupreply_groupname ON radgroupreply (GroupName);

-- ── radusergroup — user ↔ group membership ────────────────────────────────────
CREATE TABLE IF NOT EXISTS radusergroup (
    id        SERIAL  PRIMARY KEY,
    UserName  VARCHAR(64) NOT NULL DEFAULT '',
    GroupName VARCHAR(64) NOT NULL DEFAULT '',
    priority  INTEGER     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS radusergroup_username ON radusergroup (UserName);

-- ── radpostauth — post-authentication log ─────────────────────────────────────
-- Records every authentication attempt (Accept and Reject)
CREATE TABLE IF NOT EXISTS radpostauth (
    id               BIGSERIAL    PRIMARY KEY,
    username         VARCHAR(64)  NOT NULL DEFAULT '',
    pass             VARCHAR(64)  NOT NULL DEFAULT '',
    reply            VARCHAR(32)  NOT NULL DEFAULT '',
    CalledStationId  VARCHAR(50)  NOT NULL DEFAULT '',
    CallingStationId VARCHAR(50)  NOT NULL DEFAULT '',
    authdate         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    Class            VARCHAR(64)  DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS radpostauth_username ON radpostauth (username);
CREATE INDEX IF NOT EXISTS radpostauth_authdate  ON radpostauth (authdate);

-- ── nas — NAS/client definitions ─────────────────────────────────────────────
-- FreeRADIUS reads this table at startup when read_clients=yes in sql module.
-- IMPORTANT (CP-3): NAS changes require a full FreeRADIUS restart, not HUP.
CREATE TABLE IF NOT EXISTS nas (
    id          SERIAL   PRIMARY KEY,
    nasname     TEXT     NOT NULL,
    shortname   TEXT,
    type        TEXT     DEFAULT 'other',
    ports       INTEGER,
    secret      TEXT     NOT NULL DEFAULT 'secret',
    server      TEXT,
    community   TEXT,
    description TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS nas_nasname ON nas (nasname);

-- ── nasreload — tracks NAS reload requests ───────────────────────────────────
CREATE TABLE IF NOT EXISTS nasreload (
    NASIPAddress INET        PRIMARY KEY,
    ReloadTime   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── radacct — RADIUS accounting records (PARTITIONED) ────────────────────────
-- Declared as a partitioned table — partitions created in 03-pg-partman.sql
-- PRIMARY KEY includes AcctStartTime because PostgreSQL requires the partition
-- key to be part of the primary key in declarative range partitioning.
CREATE TABLE IF NOT EXISTS radacct (
    RadAcctId          BIGSERIAL,
    AcctSessionId      VARCHAR(64)   NOT NULL DEFAULT '',
    AcctUniqueId       VARCHAR(32)   NOT NULL DEFAULT '',
    UserName           VARCHAR(64)   NOT NULL DEFAULT '',
    Realm              VARCHAR(64)            DEFAULT '',
    NASIPAddress       INET          NOT NULL,
    NASPortId          VARCHAR(15)            DEFAULT NULL,
    NASPortType        VARCHAR(32)            DEFAULT NULL,
    AcctStartTime      TIMESTAMPTZ            DEFAULT NULL,
    AcctUpdateTime     TIMESTAMPTZ            DEFAULT NULL,
    AcctStopTime       TIMESTAMPTZ            DEFAULT NULL,
    AcctInterval       BIGINT                 DEFAULT NULL,
    AcctSessionTime    BIGINT                 DEFAULT NULL,
    AcctAuthentic      VARCHAR(32)            DEFAULT NULL,
    ConnectInfo_start  VARCHAR(50)            DEFAULT NULL,
    ConnectInfo_stop   VARCHAR(50)            DEFAULT NULL,
    AcctInputOctets    BIGINT                 DEFAULT NULL,
    AcctOutputOctets   BIGINT                 DEFAULT NULL,
    CalledStationId    VARCHAR(50)   NOT NULL DEFAULT '',
    CallingStationId   VARCHAR(50)   NOT NULL DEFAULT '',
    AcctTerminateCause VARCHAR(32)   NOT NULL DEFAULT '',
    ServiceType        VARCHAR(32)            DEFAULT NULL,
    FramedProtocol     VARCHAR(32)            DEFAULT NULL,
    FramedIPAddress    INET                   DEFAULT NULL,
    FramedIPv6Address  INET                   DEFAULT NULL,
    FramedIPv6Prefix   INET                   DEFAULT NULL,
    FramedInterfaceId  VARCHAR(44)            DEFAULT NULL,
    DelegatedIPv6Prefix INET                  DEFAULT NULL,
    Class              VARCHAR(64)            DEFAULT NULL,
    PRIMARY KEY (RadAcctId, AcctStartTime)
) PARTITION BY RANGE (AcctStartTime);

-- Indexes on the partitioned parent table (inherited by all child partitions)
CREATE INDEX IF NOT EXISTS radacct_acctuniqueid   ON radacct (AcctUniqueId);
CREATE INDEX IF NOT EXISTS radacct_username        ON radacct (UserName);
CREATE INDEX IF NOT EXISTS radacct_nasipaddress    ON radacct (NASIPAddress);
CREATE INDEX IF NOT EXISTS radacct_acctstarttime   ON radacct (AcctStartTime);
CREATE INDEX IF NOT EXISTS radacct_acctstoptime    ON radacct (AcctStopTime);
