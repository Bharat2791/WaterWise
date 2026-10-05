# WaterWise AI

WaterWise AI is a municipal water-supply intelligence platform that analyzes citizen complaints, detects hotspots, predicts maintenance risk, and prioritizes field resources for urban water networks.

## Problem statement
Urban water systems face repeated complaints, infrastructure decay, and pressure fluctuations. Without a serious operational intelligence layer, agencies cannot quickly determine which neighborhoods are at risk, which complaints are urgent, or why a specific area needs intervention.

## Objectives
- Convert citizen complaints into structured operational intelligence
- Detect water supply and leakage hotspots using geographic clustering
- Predict maintenance risk using complaint patterns and operational features
- Prioritize scarce resources with explainable reasoning
- Maintain a live command-center experience for city operations teams

## Features
- Complaint ingestion and AI analysis
- NLP issue detection and severity estimation
- Location extraction and duration detection
- Hotspot analysis using DBSCAN clustering
- Maintenance-risk predictions and priority analytics
- GIS-friendly map and dashboard views
- CSV/XLSX upload support
- Real backend data and SQLAlchemy persistence

## Architecture
- Backend: FastAPI + SQLAlchemy + Python
- Frontend: React + Vite + Tailwind + Recharts + Leaflet
- Database: Postgres-compatible SQLAlchemy models with SQLite fallback for local development
- Analytics: DBSCAN, feature-based risk scoring, and explainable priority engine

## Folder structure
```text
backend/
  app/
    api/
    models/
    schemas/
    services/
    scripts/
frontend/
  src/
README.md
```

## Database setup
The default local environment uses SQLite for portable development. Complaint tables start empty; records are created when submitted or imported. For Postgres, set `DATABASE_URL` to a Postgres connection string such as:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/waterwise
```

Then initialize the schema with the app startup flow or by using SQLAlchemy metadata creation.

## Backend setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Frontend setup
```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

## Role access
The frontend opens at `/login`. A user chooses complaint giver or complaint receiver, registers with their own email and password, then signs in using those credentials. No activation or invitation code is required. Complaint givers can access their own submitted complaints; complaint receivers can access municipal analytics. The backend hashes passwords and issues signed bearer tokens; receiver and complaint routes enforce roles and record ownership.

Set `AUTH_SECRET_KEY` to a long, unique random value in the backend environment. Do not commit real values. In development, an unset `AUTH_SECRET_KEY` is generated temporarily and sessions expire when the backend restarts. Production must configure this value and serve the application over HTTPS. Receiver registration is open, so use this role only for trusted staff.

This is a minimal account system, not a complete identity provider: there is no email verification, password-reset flow, rate limiting, or refresh-token rotation. Add these controls before exposing it to the public internet.

## Environment variables
See `.env.example` for required values.

## API documentation
Swagger UI is available at: http://localhost:8000/docs

## NLP methodology
The NLP pipeline begins with text cleaning, tokenization, keyword extraction, issue classification, duration timing, location extraction, severity estimation, and confidence calculation. If spaCy is unavailable, the system falls back to keyword scoring and regex rules so the platform remains operational.

## Hotspot methodology
DBSCAN groups nearby complaint coordinates into dense clusters. The app measures:
- `eps`: the geographic radius for neighborhood density
- `min_samples`: minimum complaint count per cluster
- `clusters`: dense complaint neighborhoods
- `noise`: isolated outliers
This supports hotspot detection for recurring water-supply issues.

## Maintenance prediction methodology
Risk is estimated from complaint frequency, recent incident volume, severity levels, affected population, recurrence signals, and hotspot intensity. It is a decision-support output rather than a guaranteed asset failure prediction.

## Priority scoring methodology
Priority scores combine severity, affected population, complaint frequency, recurrence, maintenance risk, and hotspot intensity to produce an explainable operational ranking.

## Complaint workflow
1. Open the dashboard and confirm live metrics.
2. Visit the complaints workspace and submit a complaint.
3. Click Analyze Complaint.
4. Review AI interpretation and priority calculation.
5. Confirm the complaint is saved and visible on the GIS map.
6. Review hotspot, risk, and resource-priority pages.

## Limitations
- Optional synthetic sample records can be added using the sample-data script for civic scenario modeling; they are not loaded automatically.
- Production-grade geospatial analytics may require richer sensor and network datasets.
- NLP classification is rule-driven and designed to be upgradeable with a stronger model later.

## Future improvements
- Real-time websocket updates
- PostGIS spatial indexing and geofencing
- ML model retraining with historical maintenance data
- Advanced GIS overlays and operator workflows
