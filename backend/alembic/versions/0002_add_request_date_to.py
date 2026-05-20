"""add request_date_to to time off requests

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-20
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "hours_time_off_requests",
        sa.Column("request_date_to", sa.Date, nullable=True),
    )


def downgrade():
    op.drop_column("hours_time_off_requests", "request_date_to")
