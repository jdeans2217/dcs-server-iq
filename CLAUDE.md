# DCS Server Intelligence

## Quick Start

```bash
./start.sh
```

Starts both API and frontend servers with LAN access. Press Ctrl+C to gracefully stop both.

## Access URLs

- Frontend: http://<your-ip>:5173/
- API: http://<your-ip>:8000/
- API Docs: http://<your-ip>:8000/docs

## Manual Start (if needed)

```bash
# API server (port 8000)
uvicorn api:app --host 0.0.0.0 --port 8000

# Frontend dev server (port 5173)
cd frontend && npm run dev
```
