# ADR-005: Pydantic for Data Validation

**Status:** Accepted  
**Date:** 2026-11-13

## 1. Context
FastAPI integrates tightly with Pydantic v2 for request/response models and settings.

## 2. Problem
We need consistent validation at HTTP and configuration boundaries without duplicating ad-hoc parsers.

## 3. Decision
Use **Pydantic v2** for API schemas and **pydantic-settings** for configuration.

## 4. Alternatives Considered
- Marshmallow / attrs-only models
- Manual validation in route functions
- Dataclasses without validators

## 5. Reasons for Selection
- Native FastAPI support
- Clear JSON schema / OpenAPI generation
- Settings loading from environment with low boilerplate

## 6. Trade-offs and Disadvantages
- Domain entities should not become “Pydantic everywhere” by default
- Large models can encourage anemic domain design if misused

## 7. Consequences
- Presentation schemas use Pydantic
- Domain prefers plain entities/value objects unless a justified shared model exists
- `Settings` lives in `app/core/config.py`

## 8. Revisit When
- Validation needs diverge strongly from Pydantic capabilities (rare)
