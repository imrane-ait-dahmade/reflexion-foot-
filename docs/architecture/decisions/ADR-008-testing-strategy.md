# ADR-008: Testing Strategy

**Status:** Accepted  
**Date:** 2026-11-13

## 1. Context
We already have foundation smoke tests with Pytest + FastAPI `TestClient`. Business modules will add rules that must not regress.

## 2. Problem
Without a clear test pyramid, teams either skip tests or over-invest in brittle end-to-end suites.

## 3. Decision
Use **Pytest** with this pyramid:
1. **Domain/unit tests** — pure rules, no I/O (preferred for scoring/session invariants)
2. **Application tests** — use cases with fakes/in-memory repos
3. **API tests** — `TestClient` for HTTP contracts
4. **Optional integration tests** — real PostgreSQL when persistence is wired (CI service), not required for unit-only PRs

## 4. Alternatives Considered
- Only manual Swagger checks
- Only full E2E browser tests
- unittest instead of Pytest

## 5. Reasons for Selection
- Pytest is standard for FastAPI projects
- `TestClient`/`httpx` already proven in this repo
- Keeps feedback fast while protecting domain rules

## 6. Trade-offs and Disadvantages
- Integration tests need CI infrastructure later
- Over-mocking infrastructure can hide SQL bugs

## 7. Consequences
- `tests/` remains the backend test root
- New modules add focused tests next to behavior
- Coverage targets are not claimed until measured

## 8. Revisit When
- Flaky integration suites dominate CI time, or critical paths need contract testing with the Next.js client
