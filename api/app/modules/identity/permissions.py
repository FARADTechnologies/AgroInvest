"""What staff may do in the administration console.

The administrator holds every permission and is the only one who manages staff accounts.
Staff accounts the administrator creates (role STAFF) get a position and exactly the
permissions the administrator ticks. The older SPECIALIST and SUPERVISOR roles keep their
original rights unless the administrator sets explicit permissions on them.
"""

from enum import StrEnum

from app.modules.identity.models import Role, User


class Permission(StrEnum):
    APPLICATIONS_VIEW = "APPLICATIONS_VIEW"
    APPLICATIONS_DECIDE = "APPLICATIONS_DECIDE"
    IDENTIFIER_REVEAL = "IDENTIFIER_REVEAL"
    AREAS_MANAGE = "AREAS_MANAGE"
    COMPETITIONS_MANAGE = "COMPETITIONS_MANAGE"
    COMPETITIONS_APPROVE = "COMPETITIONS_APPROVE"
    LISTINGS_MANAGE = "LISTINGS_MANAGE"
    STATS_VIEW = "STATS_VIEW"
    SUITABILITY_MANAGE = "SUITABILITY_MANAGE"
    INTEGRATION_MANAGE = "INTEGRATION_MANAGE"
    AUDIT_VIEW = "AUDIT_VIEW"


# Shown in the administration console when the administrator sets up an account.
PERMISSION_LABELS: dict[Permission, tuple[str, str]] = {
    Permission.APPLICATIONS_VIEW: ("Müraciətlərə baxmaq", "Müraciətlər, sənədlər və tarixçə"),
    Permission.APPLICATIONS_DECIDE: (
        "Sənədləri yoxlamaq və qərar vermək",
        "Baxılmağa götürmək, əlavə məlumat istəmək, qalib və ya imtina",
    ),
    Permission.IDENTIFIER_REVEAL: (
        "FİN/VÖEN/pasportu tam görmək",
        "Səbəb göstərilir və audit jurnalına yazılır",
    ),
    Permission.AREAS_MANAGE: ("Sahələri əlavə etmək və redaktə etmək", "Poliqon, şərtlər, status"),
    Permission.COMPETITIONS_MANAGE: (
        "Müsabiqə hazırlamaq",
        "Qaralama, lotlar, təsdiqə göndərmək, nəticəni elan etmək",
    ),
    Permission.COMPETITIONS_APPROVE: (
        "Müsabiqəni təsdiqləmək",
        "Torpağın təklifə çıxarılmasını təsdiq etmək və ya qaytarmaq",
    ),
    Permission.LISTINGS_MANAGE: ("Elan yerləşdirmək", "Sahəni xəritədə çəkib birbaşa elan etmək"),
    Permission.STATS_VIEW: ("Statistika və hesabatlar", "Göstəricilər və Excel hesabatı"),
    Permission.SUITABILITY_MANAGE: (
        "Uyğunluq metodologiyası",
        "Ekspert çəkilərini dəyişmək və yeni versiya dərc etmək",
    ),
    Permission.INTEGRATION_MANAGE: (
        "EKTİS inteqrasiyası",
        "Mesajları yenidən göndərmək, test nasazlığı",
    ),
    Permission.AUDIT_VIEW: ("Audit jurnalı", "Kimin nə etdiyini görmək və yoxlamaq"),
}

ALL = frozenset(Permission)

# Rights of the original staff roles, used while the administrator has not set their own.
ROLE_DEFAULTS: dict[Role, frozenset[Permission]] = {
    Role.SPECIALIST: frozenset(
        {
            Permission.APPLICATIONS_VIEW,
            Permission.APPLICATIONS_DECIDE,
            Permission.IDENTIFIER_REVEAL,
            Permission.AREAS_MANAGE,
            Permission.COMPETITIONS_MANAGE,
            Permission.STATS_VIEW,
            Permission.SUITABILITY_MANAGE,
            Permission.INTEGRATION_MANAGE,
        }
    ),
    Role.SUPERVISOR: frozenset(
        {
            Permission.APPLICATIONS_VIEW,
            Permission.COMPETITIONS_APPROVE,
            Permission.STATS_VIEW,
            Permission.AUDIT_VIEW,
        }
    ),
}


def effective(user: User) -> frozenset[Permission]:
    if user.role == Role.ADMIN:
        return ALL
    if user.role not in (Role.STAFF, Role.SPECIALIST, Role.SUPERVISOR):
        return frozenset()
    if user.permissions is not None:
        return frozenset(Permission(p) for p in user.permissions if p in Permission.__members__)
    return ROLE_DEFAULTS.get(user.role, frozenset())


def has(user: User, permission: Permission) -> bool:
    return permission in effective(user)
