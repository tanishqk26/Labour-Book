"""
Alembic Environment Configuration

This file is loaded by Alembic when running migration commands.
It wires up the async engine and discovers all ORM models via app.models.
"""

import asyncio
import selectors
import sys
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Import settings for the live database URL
from app.config import settings

# Import Base + all models so Alembic can detect changes
from app.models import Base  # noqa: F401
# As you add models, they must be imported (directly or via app/models/__init__.py)

# ---------------------------------------------------------------------------
# Alembic Config
# ---------------------------------------------------------------------------
config = context.config

# Override sqlalchemy.url with the value from our settings
# ConfigParser treats % as interpolation; escape it to %%
config.set_main_option("sqlalchemy.url", settings.database_url.replace("%", "%%"))

# Setup logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata target for autogenerate
target_metadata = Base.metadata


# ---------------------------------------------------------------------------
# Offline migrations (generate SQL without connecting)
# ---------------------------------------------------------------------------
def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


# ---------------------------------------------------------------------------
# Online migrations (connect and run)
# ---------------------------------------------------------------------------
def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    # On Windows with Python 3.12+, asyncio defaults to ProactorEventLoop
    # which is incompatible with psycopg async. Use SelectorEventLoop instead.
    if sys.platform == "win32":
        loop = asyncio.SelectorEventLoop(selectors.SelectSelector())
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(run_async_migrations())
        finally:
            loop.close()
    else:
        asyncio.run(run_async_migrations())


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
