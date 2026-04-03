# PostgreSQL 16 with pg_partman for radacct monthly partitioning
# pg_partman automates partition creation/maintenance (INFRA-05)
FROM postgres:16

RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-16-partman \
    && rm -rf /var/lib/apt/lists/*
