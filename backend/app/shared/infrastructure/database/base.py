"""SQLAlchemy 2.x declarative base and shared metadata.

V2 application models subclass `Base`. Import
`app.shared.infrastructure.database.models` so they register on `Base.metadata`
before Alembic inspection. Do not call `metadata.create_all()` from app startup;
use Alembic against a dedicated V2 database only.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared DeclarativeBase for Cognitif Connexion Foot 2.0."""
