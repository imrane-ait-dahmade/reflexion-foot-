# ADR-002: Clean Architecture Principles

**Status:** Accepted  
**Date:** 2026-11-13

## 1. Context
Business rules (session lifecycle, one attempt, scoring meaning, AI eligibility) must outlive frameworks.

## 2. Problem
Mixing HTTP, ORM, and domain rules makes migration from the existing Next.js backend paths risky and hard to test.

## 3. Decision
Apply **Clean Architecture** layers per module: presentation → application → domain ← infrastructure.

## 4. Alternatives Considered
- Classic MVC with fat controllers
- Transaction-script only
- Hexagonal with heavier port proliferation everywhere

## 5. Reasons for Selection
- Protects domain from FastAPI/SQLAlchemy churn
- Enables unit tests on rules without a database
- Fits modular monolith packaging

## 6. Trade-offs and Disadvantages
- More folders and types than a script-style API
- Risk of ceremony if applied dogmatically to trivial CRUD

## 7. Consequences
- Domain must not import FastAPI or SQLAlchemy
- Infrastructure implements domain ports
- Presentation stays thin

## 8. Revisit When
- Layers add cost without clarity for a clearly trivial module (then allow a simplified slice, documented locally)
