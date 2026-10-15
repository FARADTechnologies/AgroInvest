"""Reference roads and water for suitability distances

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-15 04:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geometry

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_geospatial_table(
        "geo_feature",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("subtype", sa.String(length=20), nullable=False),
        sa.Column(
            "geom",
            Geometry(
                geometry_type="GEOMETRY",
                srid=4326,
                dimension=2,
                spatial_index=False,
                from_text="ST_GeomFromEWKT",
                name="geometry",
                nullable=False,
            ),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_geo_feature")),
    )
    op.create_index(op.f("ix_geo_feature_kind"), "geo_feature", ["kind"], unique=False)
    op.create_geospatial_index(
        "idx_geo_feature_geom", "geo_feature", ["geom"], unique=False, postgresql_using="gist", postgresql_ops={}
    )


def downgrade() -> None:
    op.drop_geospatial_index(
        "idx_geo_feature_geom", table_name="geo_feature", postgresql_using="gist", column_name="geom"
    )
    op.drop_index(op.f("ix_geo_feature_kind"), table_name="geo_feature")
    op.drop_geospatial_table("geo_feature")
