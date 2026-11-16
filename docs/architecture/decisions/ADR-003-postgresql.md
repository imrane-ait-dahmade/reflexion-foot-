# ADR-003: PostgreSQL as Primary Database

**Status:** Accepted (wiring deferred)  
**Date:** 2026-11-13

## 1. Context
The existing product already uses PostgreSQL (Neon) for sessions, results, and AI report storage.

## 2. Problem
The new backend needs a durable relational store for coaches, sessions, and results with constraints and migrations.

## 3. Decision
Use **PostgreSQL** as the system of record for the FastAPI backend.

## 4. Alternatives Considered
- SQLite for production
- Document database as primary store
- Dual-write to multiple primary databases

## 5. Reasons for Selection
- Continuity with the existing production data model family
- Strong relational constraints (unique attempts, FKs, enums)
- Mature tooling and hosting options already in use

## 6. Trade-offs and Disadvantages
- Requires connection pooling and migration discipline
- Not ideal as an ultra-flexible schemaless store

## 7. Consequences
- `DATABASE_URL` reserved in settings
- No live connection in this foundation step
- Schema evolution via Alembic when models exist

## 8. Revisit When
- Workloads prove PostgreSQL is the bottleneck *and* a specialized store is justified for a bounded use case (cache/search), not as a replacement primary DB without evidence
