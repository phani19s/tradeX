"""add ai chat history and price alerts

Revision ID: 20260621_ai_alerts_risk
Revises:
Create Date: 2026-06-21
"""

from alembic import op
import sqlalchemy as sa


revision = "20260621_ai_alerts_risk"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "chat_history",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_table(
        "price_alerts",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("symbol", sa.String(), nullable=False, index=True),
        sa.Column("condition_type", sa.String(), nullable=False),
        sa.Column("target_price", sa.Float(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("triggered", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("triggered_at", sa.DateTime(), nullable=True),
    )


def downgrade():
    op.drop_table("price_alerts")
    op.drop_table("chat_history")
