# ADR-006: REST API and Versioning Strategy

**Status:** Accepted  
**Date:** 2026-11-13

## 1. Context
Clients (web coach/player UIs, later maybe tools) need a stable HTTP API.

## 2. Problem
Without versioning, breaking changes force coordinated frontend deploys or silent breakage.

## 3. Decision
Expose a **versioned REST API** under `/api/v1`, aggregated by `app/api/v1/router.py`. Keep unversioned `/` and `/health` for ops/smoke checks.

## 4. Alternatives Considered
- Unversioned `/api` only
- Header-based versioning only
- GraphQL as primary API

## 5. Reasons for Selection
- Simple for browser clients and OpenAPI consumers
- Compatible with gradual module rollout
- Clear upgrade path to `/api/v2` if needed

## 6. Trade-offs and Disadvantages
- URL versioning can duplicate routes during transitions
- REST is less flexible than GraphQL for arbitrary client queries

## 7. Consequences
- Feature routers mount under `/api/v1/...`
- Breaking changes require a new version or careful compatibility policy

## 8. Revisit When
- Multiple clients need radically different query shapes that REST cannot serve efficiently
