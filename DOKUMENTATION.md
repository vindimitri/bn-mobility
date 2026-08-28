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

## Domain erreichbar machen (erledigt — Bonn; gleiche Logik für Wien)

Wie wir es **schlussendlich** hinbekommen haben (kurz, deduktiv):

1. Domain gekauft (damals `bonn-mobility.de` bei IONOS; jetzt Ziel `wien-mobility.at`).
2. Domain in **Vercel** dem Projekt hinzugefügt (Settings → Domains).
3. **Nicht** bei IONOS einzelne A/CNAME-Records pflegen (war fehleranfällig).
4. Stattdessen bei IONOS die **Nameserver auf Vercel** umgestellt: `ns1.vercel-dns.com` / `ns2.vercel-dns.com`.
5. Vercel zeigt Domain **Valid** + **SSL** → DNS/Zertifikat ok.
6. Heim-Router-DNS kann nachhängen → Check per Mobilfunk / DNS `8.8.8.8` oder `1.1.1.1`.
7. Apex-404 ≠ Domain kaputt → oft fehlendes/falsches Deploy (Framework **Next.js**, Output Directory leer lassen, neu deployen).

Merksatz: **Vercel steuert DNS (Nameserver) + Hosting; Registrar nur Domain + NS-Delegation.**

---

## Als Nächstes
1. App-Deploy (404 weg) / Stadt-Pivot Wien (`wien-mobility.at`)
2. Compose: Postgres + Schema
3. GBFS-Poll speichern (WienMobil Rad)
4. API + Karte
