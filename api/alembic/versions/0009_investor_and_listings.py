"""Investors and sahibkar listings

The applicant role becomes INVESTOR; ENTREPRENEUR (sahibkar) now means the party that places
listings. Investors state a budget and interests; farm areas drawn by a sahibkar are LISTING
areas; OSM-sourced areas keep their way ID so anyone can check them on openstreetmap.org.

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-15 13:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ROLES_OLD = "('ENTREPRENEUR', 'SPECIALIST', 'SUPERVISOR', 'ADMIN')"
ROLES_NEW = "('INVESTOR', 'ENTREPRENEUR', 'SPECIALIST', 'SUPERVISOR', 'ADMIN')"
SOURCES_OLD = "('OSM', 'SYNTHETIC', 'MANUAL', 'EKTIS')"
SOURCES_NEW = "('OSM', 'SYNTHETIC', 'MANUAL', 'EKTIS', 'LISTING')"


def upgrade() -> None:
    op.execute("ALTER TABLE app_user DROP CONSTRAINT ck_app_user_role")
    op.execute(f"ALTER TABLE app_user ADD CONSTRAINT ck_app_user_role CHECK (role IN {ROLES_NEW})")
    # Everyone who applied so far did what an investor does now.
    op.execute("UPDATE app_user SET role = 'INVESTOR' WHERE role = 'ENTREPRENEUR'")
    op.execute("UPDATE status_history SET actor_role = 'INVESTOR' WHERE actor_role = 'ENTREPRENEUR'")
    # The audit log is hash-chained, so its entries keep the role code they were written with.
    op.execute(
        "UPDATE app_user SET email = 'investor@agro-demo.test' WHERE email = 'sahibkar@agro-demo.test' "
        "AND NOT EXISTS (SELECT 1 FROM app_user WHERE email = 'investor@agro-demo.test')"
    )

    op.add_column("entrepreneur", sa.Column("budget_azn", sa.Numeric(14, 2), nullable=True))
    op.add_column("entrepreneur", sa.Column("interests", postgresql.ARRAY(sa.String(16)), nullable=True))

    op.execute("ALTER TABLE farm_area DROP CONSTRAINT ck_farm_area_datasource")
    op.execute(
        f"ALTER TABLE farm_area ADD CONSTRAINT ck_farm_area_datasource CHECK (data_source IN {SOURCES_NEW})"
    )
    op.add_column("farm_area", sa.Column("osm_ref", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("farm_area", "osm_ref")
    op.execute("DELETE FROM farm_area WHERE data_source = 'LISTING'")
    op.execute("ALTER TABLE farm_area DROP CONSTRAINT ck_farm_area_datasource")
    op.execute(
        f"ALTER TABLE farm_area ADD CONSTRAINT ck_farm_area_datasource CHECK (data_source IN {SOURCES_OLD})"
    )
    op.drop_column("entrepreneur", "interests")
    op.drop_column("entrepreneur", "budget_azn")
    op.execute("UPDATE app_user SET role = 'ENTREPRENEUR' WHERE role = 'INVESTOR'")
    op.execute("ALTER TABLE app_user DROP CONSTRAINT ck_app_user_role")
    op.execute(f"ALTER TABLE app_user ADD CONSTRAINT ck_app_user_role CHECK (role IN {ROLES_OLD})")
