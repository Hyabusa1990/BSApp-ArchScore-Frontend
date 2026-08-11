---
description: >
  Batch-gesteuertes Arbeiten. Holt alle offenen GitLab-Issues für ein spezifisches Label 
  (z.B. BUG oder SECURITY), analysiert Kritikalität und Umfang, erstellt einen priorisierten 
  Abarbeitungsplan in Arbeitspaketen und führt die Implementierung nach Freigabe schrittweise durch.
argument-hint: <label>
---

Ich möchte eine Triage und anschließende Batch-Abarbeitung für alle offenen Issues mit dem Label `$1` durchführen. Gehe strikt nach folgendem Ablauf vor:

---

## Phase 1 — Issues laden und filtern

1. `git remote get-url origin` → GitLab-Projektpfad ermitteln (`project_id`, z.B. `bsapp/score-systems/liga`)
2. Über `mcp__gitlab__list_issues` (oder vergleichbare Such-Tools):
   - Alle offenen Issues laden, die das Label `$1` (z.B. BUG oder SECURITY) haben.
3. Für jedes gefundene Issue die Beschreibung und bisherige Kommentare grob überfliegen (`mcp__gitlab__get_issue` / `mcp__gitlab__list_issue_discussions`), um den Kontext zu verstehen.

---

## Phase 2 — Analyse & Triage

4. Analysiere jedes Issue nach folgenden Kriterien:
   - **Kritikalität:** Wie schwerwiegend ist das Problem? (Hoch/Mittel/Niedrig) – Bei SECURITY-Issues ist die Kritikalität grundsätzlich als Hoch anzunehmen, bei BUGs hängt es von den betroffenen Systemteilen (z.B. Core-Backend vs. UI-Glitch) ab.
   - **Umfang:** Wie aufwendig wird die Behebung? (S, M, L) – Basierend auf der Anzahl der betroffenen Dateien und der Komplexität des Fixes.
   - **Abhängigkeiten:** Gibt es Issues, die logisch zusammenhängen oder den gleichen Code-Bereich (z.B. selbe Django-Models oder Svelte-Komponenten) berühren?
   - **Klarheit & Verständnis:** Hast du das Problem und die Zielsetzung vollständig verstanden? Wenn Informationen fehlen, der Fehler nicht reproduzierbar erscheint oder die Anforderung unklar ist, formuliere konkrete Rückfragen.

---

## Phase 3 — Abarbeitungsplan & Arbeitspakete erstellen

5. Gruppiere die Issues in sinnvolle Arbeitspakete. Ein Arbeitspaket sollte entweder ein großes Issue (L) oder 2-3 kleinere, zusammenhängende Issues (S/M) enthalten. Issues mit Klärungsbedarf kommen in eine separate Liste.
6. Präsentiere mir deine Analyse und Empfehlung strukturiert im Chat:

```text
## 🎯 Triage-Ergebnis für Label: $1

Gefundene offene Issues: [Anzahl]

### ❓ Klärungsbedarf (Vor Umsetzung zu besprechen)
- Issue #[Nr] - [Titel]
  **Unklarheit/Rückfrage:** [Deine konkrete Frage an mich]

### 📦 Empfohlene Arbeitspakete & Reihenfolge

**Arbeitspaket 1: [Fokus/Thema, z.B. "Kritische Backend-Fixes"]**
- Issue #[Nr] - [Titel] | Kritikalität: [Hoch] | Aufwand: [M]
- Issue #[Nr] - [Titel] | Kritikalität: [Mittel] | Aufwand: [S]
*(Begründung: Warum diese zusammen und als Erstes?)*

**Arbeitspaket 2: [Fokus/Thema, z.B. "Frontend UI-Bugs"]**
- Issue #[Nr] - [Titel] | Kritikalität: [Mittel] | Aufwand: [L]
*(Begründung: ...)*

[Weitere Arbeitspakete...]
```

---

## Phase 4 — Warten auf Freigabe

7. Stelle die Ausführung hier EXPLIZIT ein und frage mich:

"Der Triage-Plan steht.

1. Kannst du die Fragen zu den unklaren Issues beantworten?
2. Bist du mit den vorgeschlagenen Arbeitspaketen und der Reihenfolge einverstanden?
   (ja = ich beginne mit Arbeitspaket 1 / nein = sag mir, was ich anpassen soll)"

Erst nach meiner ausdrücklichen Bestätigung darfst du mit Phase 5 beginnen.

---

## Phase 5 — Iterative Umsetzung pro Arbeitspaket

8. Für jedes bestätigte Arbeitspaket führst du nacheinander folgende Schritte durch. Arbeite Issue für Issue innerhalb des Pakets ab:

   **Für jedes Issue im aktuellen Paket:**
   - **Ticket-Update Start:** Über `mcp__gitlab__create_issue_note` einen Kommentar schreiben:
     `🚧 In Bearbeitung: Analyse und Fix für Issue #[Nr] im Rahmen von Arbeitspaket [X] gestartet.`
   - **Code-Analyse:** Relevante Dateien im Backend (Django/Python) oder Frontend (Svelte/TS) ausfindig machen und analysieren.
   - **Implementierung:** Den Code entsprechend anpassen.
   - **Testing:** Änderungen lokal validieren. Führe dazu die passenden Tests aus:
     - Backend-Änderungen: `python manage.py test`
     - Frontend-Änderungen: `npm run check`
     - Bei funktionalen Workflows: Entsprechende Playwright E2E-Tests ausführen, falls vorhanden.
   - **Ticket-Update Ende:** Nach erfolgreicher Umsetzung einen Abschlusskommentar im Issue hinterlegen:

     ```text
     ## ✅ Fix implementiert

     **Betroffene Dateien:**
     - `pfad/datei`

     **Ausgeführte Tests:** [Zusammenfassung der Testläufe]

     *Bereit für Review. (Automatisch generiert durch Claude Code)*
     ```

9. Nach Abschluss eines kompletten Arbeitspakets hältst du kurz an und meldest im Chat:
   "Arbeitspaket [X] ist vollständig abgeschlossen und die Tickets wurden aktualisiert. Soll ich direkt mit Arbeitspaket [Y] weitermachen?"
