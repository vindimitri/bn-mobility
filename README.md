# Bonn Mobility

Öffentliche Mobility-Plattform für Welo (Bonn / Rhein-Sieg).

- Website: Next.js auf Vercel (`bonn-mobility.de`)
- Backend: Docker Compose lokal → später Kubernetes (Ingestion, API, Analytics, Postgres)

Siehe `leitplanken.pdf` und `DOKUMENTATION.md`.

## Projektstruktur

```
bn-mobility/
  apps/web/                 ← Next.js (Vercel)
  services/ingestion/       ← Welo → Postgres
  services/api/             ← Read-API /v1
  services/analytics/       ← Aggregationen (async)
  db/init/                  ← Schema-SQL
  infra/compose/            ← docker-compose.yml
  packages/                 ← später shared types (optional)
```

Jeder Service bekommt später ein eigenes Image / Deployment. Namen beibehalten.

### Website lokal

```powershell
cd apps/web
npm install
npm run dev
```

**Vercel:** Root Directory auf `apps/web` stellen (Settings → General), sonst findet der Build kein Next.js mehr.

## Schritt 1 — Postgres lokal

Voraussetzung: Docker Desktop (läuft) und `docker` in der PATH.

```powershell
cd C:\Users\user\Documents\BNmobility
copy .env.example .env   # falls noch nicht vorhanden
docker compose -f infra/compose/docker-compose.yml --env-file .env up -d
docker exec -it bn-postgres psql -U bn -d bnmobility -c "\dt"
```

Schema: `db/init/001_schema.sql` (nur beim **ersten** Start des Volumes).
