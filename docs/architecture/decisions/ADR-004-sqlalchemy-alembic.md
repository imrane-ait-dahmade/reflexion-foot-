# ADR-004: SQLAlchemy 2.x and Alembic

**Status:** Accepted (wiring deferred)  
**Date:** 2026-11-13

## 1. Context
We need an ORM/query layer and versioned schema migrations for PostgreSQL.

## 2. Problem
Hand-written SQL + ad-hoc schema changes do not scale for multiple feature modules.

## 3. Decision
Use **SQLAlchemy 2.x** for persistence mapping/queries and **Alembic** for migrations.

## 4. Alternatives Considered
- Raw SQL only
- Another ORM (e.g. Tortoise, Django ORM)
- SQLModel as the primary abstraction everywhere

## 5. Reasons for Selection
- SQLAlchemy 2.x is the mainstream Python SQL toolkit with explicit 2.0 style
- Alembic is the standard companion for migrations
- Fits Clean Architecture infrastructure adapters

## 6. Trade-offs and Disadvantages
- Learning curve for 2.0 typing/session patterns
- ORM misuse can hide expensive queries

## 7. Consequences
- Dependencies listed in `requirements.txt`
- `migrations/` reserved; first revision only after models exist
- Repository implementations live in module `infrastructure/`

## 8. Revisit When
- Measured query complexity or team skill suggests a different persistence approach for a specific module
