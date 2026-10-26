"""Versioned database migration; suitable for a single deployment release step."""

from pathlib import Path
from alembic import command
from alembic.config import Config


def migrate(engine):
    config = Config()
    config.set_main_option(
        "script_location", str(Path(__file__).resolve().parents[1] / "migrations")
    )
    config.attributes["connection"] = engine.connect()
    try:
        command.upgrade(config, "head")
    finally:
        config.attributes["connection"].close()


if __name__ == "__main__":
    from .database import connect

    engine, _ = connect()
    migrate(engine)
