"""SQLAlchemy 2.x declarative base and shared metadata.

Business models are not defined here yet. Future ORM models should subclass `Base`
so Alembic can discover them via `Base.metadata`.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared DeclarativeBase for Cognitif Connexion Foot 2.0."""
