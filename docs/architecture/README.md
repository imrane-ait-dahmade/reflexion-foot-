# Architecture — Cognitif Connexion Foot 2.0

**Status:** Architecture foundation (no full business migration yet)  
**Branch inspected:** `master`  
**Layout:** `frontend/` (existing Next.js product) · `backend/` (new FastAPI modular monolith)

## Purpose

Establish a production-oriented backend shape that can gradually absorb and extend the existing product concepts (sessions, cognitive exercises, results, coach AI reports) without rewriting the live frontend in this step.

## Approved decisions (summary)

| ID | Decision |
|----|----------|
| [ADR-001](decisions/ADR-001-modular-monolith.md) | Modular monolith |
| [ADR-002](decisions/ADR-002-clean-architecture.md) | Clean Architecture principles |
| [ADR-003](decisions/ADR-003-postgresql.md) | PostgreSQL as primary database |
| [ADR-004](decisions/ADR-004-sqlalchemy-alembic.md) | SQLAlchemy 2.x + Alembic |
| [ADR-005](decisions/ADR-005-pydantic.md) | Pydantic v2 for validation |
| [ADR-006](decisions/ADR-006-rest-api-versioning.md) | REST API + `/api/v1` versioning |
| [ADR-007](decisions/ADR-007-pragmatic-ddd.md) | Pragmatic DDD |
| [ADR-008](decisions/ADR-008-testing-strategy.md) | Testing strategy |

## Layer responsibilities

### Presentation
FastAPI routers, HTTP schemas (Pydantic), status codes, request validation. **No** complex business rules.

### Application
Use cases / application services, orchestration, transaction boundaries, application DTOs.

### Domain
Entities, justified value objects, domain rules, repository **interfaces**, scoring contracts. **No** FastAPI / SQLAlchemy / provider SDKs.

### Infrastructure
SQLAlchemy models & repositories, PostgreSQL, AI provider adapters, files/storage.

## Feature modules (bounded contexts)

| Module | Intent (aligned with existing product concepts) |
|--------|--------------------------------------------------|
| `identity` | Coach/user accounts |
| `organizations` | Academies / clubs |
| `teams` | Squads inside organizations |
| `players` | Player profiles joining sessions |
| `cognitive_tests` | Exercise catalog & scoring contracts |
| `test_sessions` | Sessions, join codes, lifecycle |
| `results` | Submitted outcomes |
| `progress` | Cross-session comparison when eligible |
| `ai_analysis` | Coach AI reports |

Existing frontend already implements related flows (sessions, exercises, AI reports) inside Next.js. The new backend mirrors those **business concepts**; migration of behavior is a later, evidence-based step.

## Current vs future

**Current (this foundation):**
- Package structure and core wiring
- Root `/` and `/health`
- Empty API v1 router ready for module routes
- Settings via env (DB URL reserved, unused)
- Architecture ADRs + diagrams

**Future (not done here):**
- Auth
- PostgreSQL session/engine wiring
- Alembic first revision
- Business use cases
- Replacing frontend API routes with FastAPI

## Diagrams

See [diagrams/](diagrams/):

1. [High-level system](diagrams/01-high-level-system.md)
2. [Clean Architecture layers](diagrams/02-clean-architecture-layers.md)
3. [Module organization](diagrams/03-module-organization.md)
4. [Example request flow](diagrams/04-example-request-flow.md)

## Run backend

```bash
cd backend
.\.venv\Scripts\Activate.ps1   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
pytest -v
```
