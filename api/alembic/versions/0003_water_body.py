"""Water bodies drawn on the map (the Caspian Sea)

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-15 03:40:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geometry

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_geospatial_table(
        "water_body",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column(
            "geom",
            Geometry(
                geometry_type="MULTIPOLYGON",
                srid=4326,
                dimension=2,
                spatial_index=False,
                from_text="ST_GeomFromEWKT",
                name="geometry",
                nullable=False,
            ),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_water_body")),
    )
    op.create_geospatial_index(
        "idx_water_body_geom", "water_body", ["geom"], unique=False, postgresql_using="gist", postgresql_ops={}
    )


def downgrade() -> None:
    op.drop_geospatial_index(
        "idx_water_body_geom", table_name="water_body", postgresql_using="gist", column_name="geom"
    )
    op.drop_geospatial_table("water_body")
