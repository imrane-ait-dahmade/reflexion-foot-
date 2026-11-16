# Cognitif Connexion Foot

```
football-vision-test/
  frontend/   # Next.js app (UI + API routes)
  backend/    # Backend Python (Yuuk, etc.)
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Or from the repo root:

```bash
npm run dev
```

## Backend (FastAPI)

Architecture docs: [`docs/architecture/README.md`](docs/architecture/README.md)

```bash
cd backend
# activate venv (Windows)
.\.venv\Scripts\Activate.ps1
# install deps if needed
pip install -r requirements.txt
# run API
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- API: http://127.0.0.1:8000/
- Health: http://127.0.0.1:8000/health
- API v1 prefix: http://127.0.0.1:8000/api/v1
- Swagger: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc

```bash
pytest -v
```

## Vercel

Set **Root Directory** to `frontend` in the Vercel project settings.
