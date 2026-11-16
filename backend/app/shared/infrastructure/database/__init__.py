"""SQLAlchemy async database infrastructure (engine, session, base, models)."""

from app.shared.infrastructure.database.base import Base
from app.shared.infrastructure.database.session import (
    dispose_engine,
    get_db,
    get_engine,
    get_session_factory,
)

__all__ = [
    "Base",
    "dispose_engine",
    "get_db",
    "get_engine",
    "get_session_factory",
    "import_all_models",
]


def __getattr__(name: str):
    if name == "import_all_models":
        from app.shared.infrastructure.database.models import import_all_models

        return import_all_models
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
