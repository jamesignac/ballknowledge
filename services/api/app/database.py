"""Relational storage shared by local SQLite and production PostgreSQL."""

import os
from pathlib import Path
from sqlalchemy import (
    JSON,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    create_engine,
    event,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from sqlalchemy.engine import URL

ROOT = Path(__file__).resolve().parents[3]


class Base(DeclarativeBase):
    pass


class Season(Base):
    __tablename__ = "seasons"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    metadata_json: Mapped[dict] = mapped_column(JSON)
    roster_json: Mapped[list] = mapped_column(JSON)
    fingerprint: Mapped[str] = mapped_column(String(64))


class Player(Base):
    __tablename__ = "players"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    profile: Mapped[dict] = mapped_column(JSON)


class Game(Base):
    __tablename__ = "games"
    id: Mapped[str] = mapped_column(String(10), primary_key=True)
    season: Mapped[str] = mapped_column(ForeignKey("seasons.id"), index=True)
    date: Mapped[str] = mapped_column(String(10), index=True)
    payload: Mapped[dict] = mapped_column(JSON)


class Appearance(Base):
    __tablename__ = "appearances"
    game_id: Mapped[str] = mapped_column(ForeignKey("games.id"), primary_key=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), primary_key=True)
    season: Mapped[str] = mapped_column(ForeignKey("seasons.id"))
    date: Mapped[str] = mapped_column(String(10))
    team: Mapped[str] = mapped_column(String(3))
    minutes: Mapped[float] = mapped_column(Float)
    payload: Mapped[dict] = mapped_column(JSON)
    __table_args__ = (Index("ix_appearance_scope", "season", "date", "team"),)


class ProviderCache(Base):
    __tablename__ = "provider_cache"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    source: Mapped[str] = mapped_column(String(40))
    fetched_at: Mapped[float] = mapped_column(Float)
    payload: Mapped[dict] = mapped_column(JSON)


class RefreshRun(Base):
    __tablename__ = "refresh_runs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    started_at: Mapped[float] = mapped_column(Float)
    finished_at: Mapped[float | None] = mapped_column(Float, nullable=True)
    season: Mapped[str] = mapped_column(String(7))
    status: Mapped[str] = mapped_column(String(20))
    details: Mapped[dict] = mapped_column(JSON)


def connect(url=None):
    target = (
        url
        or os.environ.get("DATABASE_URL")
        or f"sqlite:///{ROOT / '.data-cache/ballknowledge.sqlite'}"
    )
    (ROOT / ".data-cache").mkdir(exist_ok=True)
    if not url and not os.environ.get("DATABASE_URL") and os.environ.get("DB_HOST"):
        target = URL.create(
            "postgresql+psycopg",
            username=os.environ.get("POSTGRES_USER", "ballknowledge"),
            password=os.environ.get("POSTGRES_PASSWORD"),
            host=os.environ["DB_HOST"],
            database=os.environ.get("POSTGRES_DB", "ballknowledge"),
        )
    sqlite = str(target).startswith("sqlite")
    engine = create_engine(
        target,
        connect_args={"check_same_thread": False, "timeout": 30} if sqlite else {},
        isolation_level="SERIALIZABLE" if sqlite else "REPEATABLE READ",
        pool_pre_ping=True,
    )
    if sqlite:

        @event.listens_for(engine, "connect")
        def sqlite_connection(dbapi_connection, connection_record):
            dbapi_connection.isolation_level = None
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.close()

        @event.listens_for(engine, "begin")
        def sqlite_begin(connection):
            connection.exec_driver_sql("BEGIN")

    return engine, sessionmaker(engine, expire_on_commit=False)
