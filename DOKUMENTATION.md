# Bonn Mobility — Arbeitsdokumentation

Laufendes Logbuch. Neue Einträge **nur auf Befehl**.

Architektur: `leitplanken.pdf` / `projektplan.pdf`.

---

## Stand (26.08.2026)

**Fertig**
- Projekt geplant; Pläne aktualisiert (Postgres-Container, kein Supabase-Pflicht)
- GitHub: `vindimitri/bn-mobility`
- Domain `bonn-mobility.de` → Vercel (Valid + SSL; App noch 404)

**Architektur (aktuell)**
- Website: Vercel
- Backend: Ingestion, API, Analytics, **Postgres** — zuerst Compose auf dem PC, später Cloud-K8s

**Offen**
- Frontend-Deploy, Compose-Backend, Schema, Ingestion, Karte, K8s, k6

---

## Chronik

### 24.–25.08. — Planung
Welo-GBFS; Architektur; PDF-Leitplanken.

### 26.08. — Domain
IONOS → Vercel-Nameserver. Root/www ok (Heim-DNS teils verzögert).

### 26.08. — Architektur-Anpassung
Supabase entfällt. Postgres als Container. Backend zuerst lokal, dann Cloud-K8s. Pläne + PDFs aktualisiert.

---

## Als Nächstes
1. App-Deploy (404 weg)
2. Compose: Postgres + Schema
3. Welo-Poll speichern
4. API + Karte
