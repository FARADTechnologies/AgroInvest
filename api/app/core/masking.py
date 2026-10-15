def mask_identifier(value: str | None) -> str:
    """Shows only the first two and last two characters of a FİN or VÖEN: 14••••••21."""
    if not value:
        return ""
    if len(value) <= 4:
        return "•" * len(value)
    return f"{value[:2]}{'•' * (len(value) - 4)}{value[-2:]}"
