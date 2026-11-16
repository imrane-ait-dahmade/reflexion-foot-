# ADR-001: Modular Monolith Architecture

**Status:** Accepted  
**Date:** 2026-11-13

## 1. Context
Cognitif Connexion Foot 2.0 needs a backend that can grow with coaches, sessions, cognitive tests, results, and AI analysis, while an existing Next.js product already serves users.

## 2. Problem
We need clear module boundaries without the operational cost of many deployable services at this stage.

## 3. Decision
Adopt a **modular monolith**: one FastAPI deployable, internally split into feature modules (`identity`, `test_sessions`, `results`, …).

## 4. Alternatives Considered
- Microservices from day one
- Unstructured single package
- Backend-for-frontend only inside Next.js (status quo forever)

## 5. Reasons for Selection
- Matches team size and current product maturity
- Allows strong boundaries without network complexity
- Supports gradual extraction later if a module becomes a hotspot

## 6. Trade-offs and Disadvantages
- Shared database and process mean careful module discipline is required
- A bad change can still affect the whole deployable

## 7. Consequences
- Code lives under `backend/app/modules/*`
- Cross-module calls should go through application/domain APIs, not infrastructure shortcuts

## 8. Revisit When
- A module needs independent scaling, release cadence, or team ownership that the monolith blocks
