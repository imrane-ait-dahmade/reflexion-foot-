# Diagram 1 — High-Level System Architecture

```mermaid
flowchart LR
  subgraph Clients
    CoachBrowser[Coach browser]
    PlayerBrowser[Player browser]
  end

  subgraph CurrentProduct["Current product (frontend/)"]
    NextApp[Next.js App Router]
    NextAPI[Next.js Route Handlers]
  end

  subgraph NewBackend["New backend (backend/) — foundation"]
    FastAPI[FastAPI Modular Monolith]
    Modules[Feature modules]
    PG[(PostgreSQL — planned)]
    AI[AI provider adapter — planned]
  end

  CoachBrowser --> NextApp
  PlayerBrowser --> NextApp
  NextApp --> NextAPI
  NextAPI -.->|existing Neon/Drizzle path today| PG
  NextAPI -.->|existing OpenAI path today| AI

  NextApp -.->|future: call FastAPI /api/v1| FastAPI
  FastAPI --> Modules
  Modules -.->|future| PG
  Modules -.->|future| AI
```

Notes:
- Solid lines = current primary path for the live product UI.
- Dashed lines = planned or dual-running paths during migration.
- This foundation does **not** disconnect the existing frontend data path.
