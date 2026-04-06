#!/bin/sh
set -e

echo "Running Alembic migrations..."
alembic upgrade head || echo "WARNING: Alembic migration failed (app tables may need manual creation)"

echo "Starting uvicorn..."
exec "$@"
