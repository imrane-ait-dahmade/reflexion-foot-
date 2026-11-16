# ADR-007: Pragmatic Domain-Driven Design

**Status:** Accepted  
**Date:** 2026-11-13

## 1. Context
The product has real domain language: sessions, join codes, cognitive tests, one attempt, AI report eligibility, cohort comparison.

## 2. Problem
Full ceremonial DDD (always aggregates, always domain events, always bounded-context messaging) would slow delivery for a modular monolith.

## 3. Decision
Apply **pragmatic DDD**: ubiquitous language, feature modules as bounded contexts, domain rules where they matter; skip heavy patterns until justified.

## 4. Alternatives Considered
- Pure CRUD without domain modeling
- Strict DDD with events/buses everywhere from day one

## 5. Reasons for Selection
- Protects high-value rules (scoring interpretation, session lifecycle)
- Avoids overengineering low-risk configuration data
- Aligns with Clean Architecture without dogma

## 6. Trade-offs and Disadvantages
- Judgment calls on “is this domain or just CRUD?”
- Incomplete boundaries can blur without review

## 7. Consequences
- Modules named after business capabilities
- Value objects/events introduced when invariants need them
- Shared kernel stays small

## 8. Revisit When
- Cross-module consistency failures show the need for stronger aggregate or event strategies
