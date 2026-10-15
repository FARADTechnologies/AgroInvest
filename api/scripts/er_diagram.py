"""Prints the data model as a Mermaid ER diagram, generated from the SQLAlchemy models.

Usage (inside the api container or a venv with the API's requirements):
    python scripts/er_diagram.py > ../docs/data-model.mmd
The diagram in docs/data-model.md is produced this way, so it always matches the code.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from geoalchemy2 import Geometry  # noqa: E402
from sqlalchemy import (  # noqa: E402
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Enum,
    Integer,
    Numeric,
    String,
    Text,
    Uuid,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB  # noqa: E402

import app.db.models  # noqa: E402,F401  (registers every model)
from app.db.base import Base  # noqa: E402

TYPES = [
    (Geometry, "geometry"),
    (Enum, "enum"),
    (Uuid, "uuid"),
    (BigInteger, "bigint"),
    (Integer, "int"),
    (Numeric, "decimal"),
    (Boolean, "bool"),
    (DateTime, "datetime"),
    (Date, "date"),
    (JSONB, "json"),
    (ARRAY, "array"),
    (Text, "text"),
    (String, "string"),
]


def type_name(column) -> str:
    for cls, name in TYPES:
        if isinstance(column.type, cls):
            return name
    return type(column.type).__name__.lower()


def main() -> None:
    tables = sorted(Base.metadata.tables.values(), key=lambda t: t.name)
    lines = ["erDiagram"]
    for table in tables:
        lines.append(f"    {table.name.upper()} {{")
        for column in table.columns:
            keys = []
            if column.primary_key:
                keys.append("PK")
            if column.foreign_keys:
                keys.append("FK")
            if column.unique:
                keys.append("UK")
            suffix = f" {','.join(keys)}" if keys else ""
            lines.append(f"        {type_name(column)} {column.name}{suffix}")
        lines.append("    }")
    for table in tables:
        for fk in sorted(table.foreign_keys, key=lambda f: f.parent.name):
            # A parent has zero or more children; a nullable key means the parent is optional.
            parent = fk.column.table.name.upper()
            side = "|o" if fk.parent.nullable else "||"
            lines.append(f'    {parent} {side}--o{{ {table.name.upper()} : "{fk.parent.name}"')
    print("\n".join(lines))


if __name__ == "__main__":
    main()
