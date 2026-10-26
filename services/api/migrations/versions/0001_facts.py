"""Initial validated facts and provider cache schema (immutable release schema)."""

from alembic import op
import sqlalchemy as sa

revision = "0001_facts"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "seasons",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("metadata_json", sa.JSON, nullable=False),
        sa.Column("roster_json", sa.JSON, nullable=False),
        sa.Column("fingerprint", sa.String(64), nullable=False),
    )
    op.create_table(
        "players",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("profile", sa.JSON, nullable=False),
    )
    op.create_table(
        "games",
        sa.Column("id", sa.String(10), primary_key=True),
        sa.Column("season", sa.String(32), sa.ForeignKey("seasons.id"), nullable=False),
        sa.Column("date", sa.String(10), nullable=False),
        sa.Column("payload", sa.JSON, nullable=False),
    )
    op.create_index("ix_games_season", "games", ["season"])
    op.create_index("ix_games_date", "games", ["date"])
    op.create_table(
        "appearances",
        sa.Column(
            "game_id", sa.String(10), sa.ForeignKey("games.id"), primary_key=True
        ),
        sa.Column(
            "player_id", sa.Integer, sa.ForeignKey("players.id"), primary_key=True
        ),
        sa.Column("season", sa.String(32), sa.ForeignKey("seasons.id"), nullable=False),
        sa.Column("date", sa.String(10), nullable=False),
        sa.Column("team", sa.String(3), nullable=False),
        sa.Column("minutes", sa.Float, nullable=False),
        sa.Column("payload", sa.JSON, nullable=False),
    )
    op.create_index("ix_appearance_scope", "appearances", ["season", "date", "team"])
    op.create_table(
        "provider_cache",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("source", sa.String(40), nullable=False),
        sa.Column("fetched_at", sa.Float, nullable=False),
        sa.Column("payload", sa.JSON, nullable=False),
    )


def downgrade():
    for table in ["provider_cache", "appearances", "games", "players", "seasons"]:
        op.drop_table(table)
