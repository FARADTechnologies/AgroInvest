"""Imports every module's models so Base.metadata knows all tables.

Alembic and the seed import this module; each feature module keeps its own
tables in its own models.py.
"""

from app.modules.applications.models import (  # noqa: F401
    Application,
    BusinessPlan,
    InfoRequest,
    StatusHistory,
)
from app.modules.areas.models import AreaSuitability, FarmArea  # noqa: F401
from app.modules.audit.models import AuditLog  # noqa: F401
from app.modules.competitions.models import (  # noqa: F401
    Competition,
    CompetitionArea,
    CompetitionRequiredDoc,
    DocumentType,
)
from app.modules.documents.models import ApplicationDocument  # noqa: F401
from app.modules.entrepreneurs.models import Entrepreneur  # noqa: F401
from app.modules.geo.models import CountryOutline, Rayon, Region, Village  # noqa: F401
from app.modules.identity.models import User  # noqa: F401
from app.modules.notifications.models import Notification  # noqa: F401
