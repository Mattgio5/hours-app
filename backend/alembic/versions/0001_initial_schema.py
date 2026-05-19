"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-19
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "hours_workers",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("jobber_user_id", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "hours_time_entries",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("worker_id", sa.Integer, nullable=False, index=True),
        sa.Column("worker_name", sa.String(100), nullable=False),
        sa.Column("entry_date", sa.Date, nullable=False),
        sa.Column("start_time", sa.String(10), nullable=False),
        sa.Column("end_time", sa.String(10), nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "hours_time_off_requests",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("worker_id", sa.Integer, nullable=False, index=True),
        sa.Column("worker_name", sa.String(100), nullable=False),
        sa.Column("request_type", sa.String(20), nullable=False),
        sa.Column("request_date", sa.Date, nullable=False),
        sa.Column("time_from", sa.String(10), nullable=True),
        sa.Column("time_to", sa.String(10), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("jobber_task_id", sa.String(100), nullable=True),
        sa.Column("admin_note", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("hours_time_off_requests")
    op.drop_table("hours_time_entries")
    op.drop_table("hours_workers")
