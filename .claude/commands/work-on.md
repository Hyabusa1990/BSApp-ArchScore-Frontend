---
description: >
  Ticket-gesteuertes Arbeiten. Holt alle Infos zu einem GitHub-Issue, analysiert den
  betroffenen Code, erstellt einen Implementierungsplan, schreibt einen "In Arbeit"-
  Kommentar ins Ticket und begleitet die Umsetzung bis zum Abschluss-Kommentar.
argument-hint: <issue-nummer>
---

Ich möchte an Issue #$1 arbeiten. Führe folgenden Ablauf durch:

---

## Phase 1 — Issue laden

1. Repo ermitteln: `gh repo view --json nameWithOwner -q .nameWithOwner` (z.B. `Hyabusa1990/BSApp-ArchScore-Frontend`)
2. Über `gh issue view $1 --repo <owner>/<repo> --json title,body,comments,labels,assignees,state`:
   Issue #$1 vollständig laden
   - Titel, Beschreibung, alle Kommentare, Labels, zugewiesene Person
3. Alle vorhandenen Kommentare lesen — besonders auf bereits diskutierte
   Lösungsansätze oder Hinweise achten
4. Issue-Inhalt strukturiert im Chat ausgeben:

```
## 📋 Issue #$1 — [Titel]

**Labels:** [Labels]
**Status:** [offen/in Bearbeitung]
**Beschreibung:**
[Inhalt]

**Bisherige Diskussion:**
[Zusammenfassung der Kommentare, falls vorhanden]
```

---

## Phase 2 — Codebase analysieren

5. Relevante Dateien identifizieren basierend auf dem Issue-Inhalt:
   - Bei Security-Issues: betroffene Endpoints, Schemas, Middleware
   - Bei Feature-Issues: betroffene Module, bestehende ähnliche Implementierungen
   - Bei Bug-Issues: betroffene Dateien, verwandte Tests
6. `git log --oneline -10` → letzten Commits anschauen für Kontext
7. Relevante Dateien lesen und analysieren

---

## Phase 3 — Implementierungsplan erstellen

8. Einen konkreten, schrittweisen Plan erstellen:

```
## 🗺️ Implementierungsplan

### Betroffene Dateien
- `pfad/datei.py` — [was sich ändert]
- `pfad/datei.ts` — [was sich ändert]

### Schritte
1. [Schritt 1 mit Begründung]
2. [Schritt 2 mit Begründung]
3. [Tests anpassen/erstellen]
4. [Manuell prüfen: ...]

### Offene Fragen / Risiken
- [Falls etwas unklar ist oder Rückfragen nötig sind]

### Geschätzter Aufwand
[Klein / Mittel / Groß]
```

---

## Phase 4 — "In Arbeit"-Kommentar ins Ticket schreiben

9. Über `gh issue comment $1 --repo <owner>/<repo> --body-file <tmp-datei>` folgenden
   Kommentar zu Issue #$1 hinzufügen (Body vorher in temporäre Datei schreiben):

```
## 🚧 In Bearbeitung

**Bearbeiter:** [git config user.name]
**Gestartet:** [aktuelles Datum]

### Geplante Umsetzung
[Implementierungsplan aus Phase 3 — Betroffene Dateien + Schritte]

### Offene Fragen
[Falls vorhanden, sonst weglassen]

---
*Dieser Kommentar wurde automatisch von Claude Code erstellt.*
```

---

## Phase 5 — Warten auf Freigabe

10. Den Plan im Chat präsentieren und EXPLIZIT fragen:

"Der Plan steht und ich habe einen Kommentar in Issue #$1 hinterlassen.
Soll ich mit der Umsetzung beginnen? (ja = ich fange an / nein = Plan anpassen)"

Erst nach ausdrücklicher Bestätigung mit der Implementierung beginnen.

---

## Phase 6 — Umsetzung

11. Plan schrittweise umsetzen
12. Nach jedem größeren Teilschritt kurz im Chat bestätigen was erledigt wurde
13. Tests ausführen: `python manage.py test` und/oder `npm run check`

---

## Phase 7 — Abschluss-Kommentar ins Ticket

14. Nach erfolgreicher Implementierung und bestandenen Tests über
    `gh issue comment $1 --repo <owner>/<repo> --body-file <tmp-datei>` folgenden
    Kommentar zu Issue #$1 hinzufügen:

```
## ✅ Implementierung abgeschlossen

**Commit:** [git-hash] — [commit-message]
**Branch:** [aktueller Branch]

### Umgesetzte Änderungen
- `pfad/datei.py` — [was geändert wurde]
- `pfad/datei.ts` — [was geändert wurde]

### Tests
- [Welche Tests ausgeführt, Ergebnis]

### Hinweise für den Review
[Was beim Code-Review besonders geprüft werden sollte]

---
*Dieser Kommentar wurde automatisch von Claude Code erstellt.*
```

15. Im Chat abschließend melden:
    "Implementierung abgeschlossen. Kommentar in Issue #$1 hinterlegt.
    Bitte das Ticket manuell auf 'In Review' / 'Closed' setzen wenn der PR gemergt ist."
