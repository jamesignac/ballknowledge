"""Operational history for scheduled refreshes."""

from alembic import op
import sqlalchemy as sa

revision = "0002_refresh_runs"
down_revision = "0001_facts"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "refresh_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("started_at", sa.Float, nullable=False),
        sa.Column("finished_at", sa.Float, nullable=True),
        sa.Column("season", sa.String(7), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("details", sa.JSON, nullable=False),
    )


def downgrade():
    op.drop_table("refresh_runs")
