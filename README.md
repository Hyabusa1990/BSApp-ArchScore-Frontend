# ArchScore — Frontend

> Live-Anzeigesystem für Bogenschießen-Liga-Wettkämpfe.  
> Zeigt während eines Satzes die laufend gespotteten Pfeilwerte sowie nach jedem Satz das Satzergebnis — für Zuschauer vor Ort.

---

## Tech Stack

| Component | Technology                                               |
|---|----------------------------------------------------------|
| Framework | [SvelteKit](https://svelte.dev/)                         |
| UI Library | [Sveltestrap](https://sveltestrap.js.org/) (Bootstrap 5) |
| Language | TypeScript                                               |
| HTTP Client | Fetch API                                                |

---

## Projektstruktur

```
archscore-frontend/
├── src/
│   ├── lib/
│   │   ├── api/
│   │   │   └── client.ts           # Fetch-Wrapper (Base URL, Auth-Header)
│   │   │
│   │   ├── stores/
│   │   │   └── match.ts            # Svelte Store: aktueller Match-Zustand
│   │   │
│   │   ├── components/
│   │   │   ├── ScoreBoard.svelte   # Haupt-Scoreboard Layout
│   │   │   ├── TeamPanel.svelte    # Anzeige pro Mannschaft
│   │   │   ├── ArrowRow.svelte     # Laufende Pfeilwerte während eines Endes
│   │   │   ├── SetResult.svelte    # Satzgewinner & kumulierte Punkte
│   │   │   └── MatchHeader.svelte  # Matchinfo (Teams, Liga, Datum)
│   │   │
│   │   └── types/
│   │       └── match.ts            # TypeScript-Interfaces für Match-Daten
│   │
│   ├── App.svelte                  # Root-Komponente
│   └── main.ts                     # Entry Point
│
├── static/
│   └── favicon.svg
│
├── .env.example                    # Umgebungsvariablen-Template
├── vite.config.ts
└── package.json
```

---

## Konfiguration

`.env.example` nach `.env` kopieren und Werte anpassen:

```bash
cp .env.example .env
```

### `.env.example`

```env
# Backend REST-API
VITE_API_BASE_URL=http://localhost:PORT/api

# Polling-Intervall in Millisekunden (Standard: 1000)
VITE_POLL_INTERVAL=1000
```

> Variablen mit `VITE_`-Präfix werden von Vite an den Browser weitergegeben.  
> Keine Secrets in `VITE_`-Variablen speichern.

---

## Getting Started

```bash
# 1. Repository klonen
git clone https://github.com/your-org/archscore-frontend.git
cd archscore-frontend

# 2. Abhaengigkeiten installieren
npm install

# 3. Konfiguration anlegen
cp .env.example .env
# VITE_API_BASE_URL auf das laufende Backend zeigen

# 4. Dev-Server starten
npm run dev
```

App erreichbar unter: [http://localhost:5173](http://localhost:5173)

---

## Skripte

| Befehl | Beschreibung |
|---|---|
| `npm run dev` | Dev-Server mit HMR starten |
| `npm run build` | Produktions-Build |
| `npm run preview` | Produktions-Build lokal vorschauen |
| `npm run check` | Svelte Type-Check |
| `npm run lint` | ESLint + Prettier pruefen |

---

## Voraussetzungen

- Node.js 20+
- npm 10+ (oder pnpm / bun)
- Laufende Instanz von [archscore-backend](https://github.com/your-org/archscore-backend)

---

## Lizenz
MIT