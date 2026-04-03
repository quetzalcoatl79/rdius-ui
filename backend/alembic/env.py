from logging.config import fileConfig

from sqlalchemy import create_engine

from alembic import context
from app.core.config import settings
from app.models.app import AppBase

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = AppBase.metadata


def include_name(name, type_, parent_names):
    """Only allow Alembic to manage the 'app' schema. NEVER touch 'radius' schema."""
    if type_ == "schema":
        return name == "app"
    return True


def run_migrations_offline() -> None:
    url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_schemas=True,
        include_name=include_name,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # Use sync engine for Alembic (asyncpg doesn't work directly with Alembic)
    sync_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    connectable = create_engine(sync_url)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_schemas=True,
            include_name=include_name,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
