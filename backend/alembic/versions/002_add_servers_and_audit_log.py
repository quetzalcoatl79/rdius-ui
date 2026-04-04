"""add servers and audit_log tables

Revision ID: 002
Revises: 001
Create Date: 2026-04-04
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "servers",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("docker_container_id", sa.String(100), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        schema="app",
    )

    op.create_table(
        "audit_log",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_email", sa.String(255), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=False),
        sa.Column("resource_id", sa.String(255), nullable=True),
        sa.Column("details", postgresql.JSONB, nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["app.users.id"], ondelete="CASCADE"),
        schema="app",
    )

    op.create_index(
        "ix_audit_log_created_at",
        "audit_log",
        ["created_at"],
        schema="app",
    )
    op.create_index(
        "ix_audit_log_user_id",
        "audit_log",
        ["user_id"],
        schema="app",
    )
    op.create_index(
        "ix_audit_log_action",
        "audit_log",
        ["action"],
        schema="app",
    )


def downgrade() -> None:
    op.drop_index("ix_audit_log_action", table_name="audit_log", schema="app")
    op.drop_index("ix_audit_log_user_id", table_name="audit_log", schema="app")
    op.drop_index("ix_audit_log_created_at", table_name="audit_log", schema="app")
    op.drop_table("audit_log", schema="app")
    op.drop_table("servers", schema="app")
