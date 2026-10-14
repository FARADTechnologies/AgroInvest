from enum import StrEnum

from sqlalchemy import Enum


def str_enum(enum_cls: type[StrEnum], length: int = 24) -> Enum:
    """Stores an enum as VARCHAR with a CHECK constraint.

    Plain strings keep migrations simple (no ALTER TYPE) and keep the codes
    readable to other systems such as EKTIS.
    """
    return Enum(
        enum_cls,
        native_enum=False,
        create_constraint=True,
        length=length,
        validate_strings=True,
        values_callable=lambda e: [m.value for m in e],
    )
