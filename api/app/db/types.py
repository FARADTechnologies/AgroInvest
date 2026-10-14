from enum import StrEnum

from sqlalchemy import Enum


def str_enum(enum_cls: type[StrEnum], length: int = 24, name: str | None = None) -> Enum:
    """Stores an enum as VARCHAR with a CHECK constraint.

    Plain strings keep migrations simple (no ALTER TYPE) and keep the codes
    readable to other systems such as EKTIS. Pass `name` when one table uses the
    same enum in two columns, so the CHECK constraints get distinct names.
    """
    return Enum(
        enum_cls,
        name=name or enum_cls.__name__.lower(),
        native_enum=False,
        create_constraint=True,
        length=length,
        validate_strings=True,
        values_callable=lambda e: [m.value for m in e],
    )
