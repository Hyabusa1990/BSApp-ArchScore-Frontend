# FACHLICHKEIT.md

Domänenwissen zum Bogensport-Liga-Wettkampf, unabhängig von Tech-Stack/Tooling — gilt für jeden Coding-Agenten, der an ArchScore arbeitet. Technisches/Architektur-Wissen steht in `CLAUDE.md`.

## Was ArchScore tut

Live-Ergebnisanzeige für Zuschauer bei Bogensport-Liga-Wettkämpfen: Die Pfeilwerte sollen für Zuschauer sichtbar sein, **bevor** sie an der Scheibe offiziell in den Schusszettel (analog oder digital) eingetragen werden. Kernidee: **pro Scheibe ein Spotter** beobachtet diese eine Scheibe durchs Fernglas und tippt die Werte sofort auf einem Tablet ein — parallel zum eigentlichen, autoritativen Schusszettel-Prozess.

## Migrations-Prinzip: 1:1 übernehmen, nichts neu erfinden

Design, Größenverhältnisse und Verhalten der Binocular-/Display-Screens sind im Referenzprojekt bereits mit den Nutzern (Spottern, Kampfrichtern, vor Ort) abgestimmt — das ist kein Rohentwurf. Bei der Migration hierher: Layout, Proportionen (`clamp()`-Formeln, Seitenverhältnisse, Touch-Target-Größen), Farbschema (Ringfarben-Zuordnung, Status-Farben) und Verhalten (optimistisches UI, 3-Sekunden-Polling, Bestätigungsschritte, Zustandsübergänge) **so übernehmen wie sie sind**. Nicht redesignen oder "verbessern", auch wenn aus reiner Code-Sicht ein anderer Ansatz naheliegt — vor Ort am Schießstand ist das schon geprüftes, funktionierendes Verhalten.

## Wettkampfstruktur

- **Begegnung** = zwei Mannschaften gegeneinander, je eine auf einer eigenen **Scheibe**. Eine Begegnung nutzt also 2 Scheiben — und damit auch 2 Spotter (einen pro Scheibe), aber nur 1 Display (siehe Display-Workflow unten).
- **Runde** = alle gleichzeitig laufenden Begegnungen eines Zeitslots (typisch 4 Begegnungen = 8 Scheiben gleichzeitig aktiv).
- **Match** (eine Seite einer Begegnung, eine Mannschaft an einer Scheibe) läuft über **5 Sätze**.
- Pro Satz schießen die **3 Schützen** der Mannschaft je **2 Pfeile** → 6 Pfeile pro Satz, in fester Reihenfolge (Position 1, 2, 3, jeweils 2 Pfeile).
- **Ringzahl-Kodierung**: 10–1 = Ringzahl, Fehlschuss ("M" = Miss) = **0** (nicht `null`!), noch nicht erfasst = `null`. Diese Unterscheidung ist wichtig — 0 und "nicht erfasst" sind fachlich verschiedene Zustände.
- **Satzpunkte**: pro Satz vergleicht man die Ringsumme beider Mannschaften — Sieger bekommt Punkte, bei Gleichstand teilen sich beide. Kommt aus der externen Liga-Verwaltung, wird hier nicht selbst berechnet (siehe unten).
- **Matchpunkte**: Summe/Ableitung aus den Satzpunkten über alle 5 Sätze, entscheidet den Sieger der Begegnung (einer Scheibenseite). Bei Gleichstand: **Stechen** (Shoot-off) mit einem "Vorteil Heim/Auswärts"-Konzept als Tie-Breaker.

## Rollen an der Scheibe / im System

- **Schütze**: schießt, Werte landen offiziell im Schusszettel (Wahrheit).
- **Spotter/Fernglas-Scorer** ("Binocular"): **einer pro Scheibe** (nicht pro Begegnung), beobachtet durchs Fernglas, erfasst Pfeilwerte vorläufig, sofort nach jedem Schuss, auf einem Tablet — bevor der Schütze offiziell bestätigt. Diese vorläufigen Werte sind reine Vorschau für die Anzeige, nicht die Wahrheit.
- **Kampfrichter**: eigene Rolle mit eigenem Zugang, überwacht/greift bei Regelverstößen ein (Details noch nicht vertieft, siehe Referenzprojekt `ref/[token]`-Route).
- **Zuschauer**: sehen nur den Bildschirm zwischen den Scheiben, keine Interaktion.

## Spotter-Workflow (Referenz: `binocular`-Route)

- Tablet pro Scheibe, aufgerufen über eine token-basierte URL (`event_token` + `scheibennummer`), kein Login nötig.
- Zeigt satzweise alle 6 Pfeilfelder des aktuellen Satzes; Keypad mit 10–6+M groß/permanent, 5–1 hinter Einblenden-Button (selten gebraucht).
- Werte werden **optimistisch** sofort angezeigt, dann an den Server geschickt — Spotter tippt im Takt, ohne auf Netzwerk zu warten.
- Bereits erfasste Pfeile sind antippbar zur nachträglichen **Korrektur**; es gibt zusätzlich **Undo** (nimmt den letzten Pfeil zurück, autoritativ vom Server).
- Nach 6 Pfeilen: Satz muss aktiv vom Spotter **bestätigt** werden ("Satzende bestätigen"), bevor der nächste Satz beginnt — kein automatischer Übergang.
- Sonderfall **"ohne digitale Meldung"**: wenn die Mannschaftsaufstellung (welche 3 Schützen) nicht digital gemeldet wurde, muss der Spotter das explizit bestätigen, bevor er weiter Pfeile erfassen kann — Treffer können aber grundsätzlich auch vor jeder Meldung eintrudeln.
- Polling alle 3 Sekunden gegen den Server (kein Login/Auth über URL-Token hinaus, mobile-first, Touch-Targets ≥48px).

## Display-Workflow (Referenz: `display`-Route)

- **Ein Bildschirm pro Begegnung**, physisch zwischen den beiden zugehörigen Scheiben aufgestellt (42–49", 20–30 m Leseabstand — UI-Größen entsprechend dominant).
- **Pairing statt Login**: Bildschirm ruft beim ersten Start eine Registrierungs-URL auf, bekommt einen 6-stelligen Pairing-Code angezeigt (wie Chromecast/Smart-TV-Pairing) und pollt, bis ein Admin ihn im Verwaltungsbereich einer Begegnung/zwei Scheibennummern zuordnet.
- Einmal gepaired, zeigt der Bildschirm **automatisch über alle Runden hinweg**, was gerade auf seinen zwei fest zugeordneten Scheibennummern läuft — kein erneutes Pairing pro Runde nötig.
- Zeigt beide Mannschaften nebeneinander (jede zu "ihrer" Scheibe hin orientiert), pro Seite ein Status: `WARTET` → `SCHUETZEN_GEMELDET` → `SATZ_LAEUFT` ⇄ `SATZ_FERTIG` (pro Satz wiederholt) → `MATCH_FERTIG`.
- Zeigt die Pfeile des **aktuell offenen Satzes** (wächst von links nach rechts, keine Platzhalter für noch nicht geschossene Pfeile — bewusst reduziert für Lesbarkeit aus der Distanz), plus Ringsumme des Satzes und, sobald ein Satz fertig ist, die Satzpunkte farblich (führt/liegt zurück).

## Veranstaltungs-Setup und Admin-Workflow

> Quelle: Nutzerbeschreibung + Mockups/Ablauf-Skizzen in `/home/gero/Downloads/Spotter-Bildschirm/` (siehe Referenzen unten). Das dortige `Ablauf.md` ist explizit als „ENTWURF – noch nicht abgestimmt" markiert — anders als die Binocular-/Display-UI im Referenzprojekt (siehe Migrations-Prinzip oben) ist dieser Teil **kein** fertig abgestimmtes Verhalten, sondern Diskussionsstand. Als Design-Richtung/Ausgangspunkt behandeln, nicht als fixe Vorgabe.

1. **Veranstaltung anlegen**: ein User (Turnierleitung/Admin) legt eine Veranstaltung an.
2. **Datenquelle für Begegnungen** — zwei Wege, im Verwaltungs-UI nur als Auswahl sichtbar:
   - **Initiale Tabelle**: Admin trägt die Ausgangstabelle (Platz, Mannschaft, Satzpunkte, Matchpunkte) direkt ein → Backend berechnet daraus den Spielplan/die Begegnungen.
   - **Ligaverwaltung verbinden**: Admin verbindet die Veranstaltung stattdessen mit einer externen Liga-App (z. B. „BSApp Liga") über URL + Login-PIN; zusätzlich wird angegeben, ob dort ein **digitaler Schusszettel** eingesetzt wird (Ja/Nein) — das entspricht den drei Ablauf-Varianten in `Ablauf.md` (ohne externes System / mit Liga-App / mit Liga-App + separater Schusszettel-App).
   - **Für das Frontend später identisch**: Das Backend bereitet in beiden Fällen dieselben aufbereiteten Begegnungs-Daten auf — das Frontend selbst unterscheidet nach der Einrichtung nicht mehr, woher die Daten kommen. Im Verwaltungs-UI ist nur die Einrichtung selbst (Tabelle vs. Verbindung) unterschiedlich.
3. **Matchkontrolle**: sobald Begegnungen existieren, gibt es pro **„Match"** (= Terminologie hier für das, was im Referenzprojekt „Runde" heißt: 4 gleichzeitige Begegnungen, 8 Scheiben parallel im Einsatz) eine Karte mit Aktiv/Inaktiv-Status und einem Freigabe-Button. Genau **ein Match/eine Runde ist immer aktiv** — erst dieses „Freigeben" sagt allen Tablets und Displays der 4 enthaltenen Begegnungen, dass ihre jeweiligen Sätze (bis zu 5 pro Begegnungsseite) jetzt laufen. Deckungsgleich mit der `LOCKED → ACTIVE → COMPLETED`-Zustandsmaschine des Referenzprojekts, nur andere Bezeichnung („Match" statt „Runde") — kein Widerspruch.
4. **Bildschirm- und Tablet-Verwaltung**: eigener Bereich, um Scheiben-Hardware der Veranstaltung zuzuordnen (siehe eigener Abschnitt unten).

## Bildschirm-Pairing (Displays)

- Displays werden **paarweise pro Scheiben-Paar** verwaltet (z. B. „Scheibe 1+2", „Scheibe 3+4", …), jedes mit eigenem **Anmelde-PIN** (kurzer alphanumerischer Code) und Aktiv/Inaktiv-Schalter.
- Ein wartendes Display (noch ungepaired, zeigt seinen Pairing-Code — siehe Referenzprojekt-Verhalten) wird vom Admin über diesen PIN einem Scheiben-Paar zugeordnet.
- **Anzeigemodus umschaltbar pro Display**: „Ergebnisse" (Trefferanzeige, Standardmodus — das bisherige Binocular-Display-Verhalten) vs. „Tabelle" (zeigt stattdessen die aktuelle Ligatabelle, z. B. während der Pause).
- **Zusätzliche Bildschirme über die Standard-Scheibenpaare hinaus** lassen sich hinzufügen (Button „Bildschirm hinzufügen"), z. B. ein frei benannter Bildschirm („Beamer"), der dauerhaft im Tabellen-Modus läuft, unabhängig von einem festen Scheiben-Paar — für permanente Tabellenanzeige zusätzlich zu den Treffer-Displays.

## Tablet-Pairing (Spotter)

- Anders als beim Display: Tablet-Pairing läuft über **QR-Code**, nicht über einen einzutippenden Code.
- Pro Scheibe (nicht pro Scheiben-Paar!) gibt es im Verwaltungs-UI einen Button („Tablet Scheibe N"), der ein Modal mit einem QR-Code öffnet.
- Der QR-Code kodiert eine Auth-URL nach dem Muster `/tablet/<UUID4>/<scheibennummer>` — die UUID4 dient gleichzeitig als Zuordnung *und* als Auth-Token. Tablet scannt, landet direkt auf der authentifizierten Spotter-Seite für genau diese Scheibe, keine manuelle Code-Eingabe nötig.

## Tabellenansicht (Referenz-Design)

Für den „Tabelle"-Anzeigemodus (Pause-Anzeige/Beamer) gibt es bereits ein gutes Vorbild in einem dritten Projekt: `/home/gero/PycharmProjects/liga/frontend/src/routes/beamer/[veranstaltung_id]` (ebenfalls nur lesend zu behandeln). Wichtige Design-Eigenschaften dort:

- Dort helles Theme (weißer Hintergrund, blauer Akzent) — für ArchScore **bewusst nicht übernehmen**: die Tabellenansicht läuft auf denselben Displays wie die Trefferanzeige, deshalb einheitlich das **dunkle Theme** der bestehenden Trefferanzeige (`#10151c` u. Ä.) verwenden. Nur Layout/Berechnung (Spalten, dynamische Schriftgröße) aus diesem Referenzprojekt übernehmen, die Farben nicht.
- Schriftgröße wird **dynamisch aus der gemessenen Container-Höhe berechnet** (`ResizeObserver`, `fontSize = (Höhe / (Zeilenzahl + 1.5)) × 0.58`), nicht rein über CSS `clamp()`/`vh` — damit füllt die Tabelle immer die verfügbare Höhe unabhängig von der Anzahl Mannschaften.
- Spalten: Platz, Mannschaft, Matchpunkte (mit Delta in Klammern, z. B. „14 (14:8)"), Satzpunkte-Netto (farbig: grün bei positiv, rot bei negativ).
- Kopfzeile mit Liga-Name + Uhrzeit (Uhrzeit aktualisiert minütlich), Tabelle selbst pollt/lädt sekündlich.
- Zebra-Streifen bei den Zeilen, `table-layout: fixed` mit festen Prozent-Breiten je Spalte.

## Wichtiges Prinzip aus dem Referenzprojekt

Das alte Projekt (`/home/gero/PycharmProjects/scoring`, siehe unten) berechnet **keine eigenen Ergebnisse** — es ist reiner Proxy/Zwischenspeicher zwischen Fernglas-Erfassung/Anzeige und einer externen Liga-Verwaltungs-App (dort liegt die Wahrheit für Satzpunkte/Matchpunkte). Für ArchScore ist das laut Auftrag **nicht** 1:1 gesetzt — ArchScore soll die Binocular-/Display-Funktionen übernehmen und dabei **auch autark ohne Schusszettel** arbeiten können. Ob/wie ArchScore selbst zur Quelle der Wahrheit für Ergebnisse wird (statt nur Proxy zu sein), ist noch offen und beim Ausbau zu klären — an dieser Stelle bewusst nicht vorweggenommen.

## Referenzquellen (alle nur lesen, nicht bearbeiten)

### `/home/gero/PycharmProjects/scoring` — bestehende Binocular-/Display-App

Dient als Vorlage zum Verständnis/zur Migration der Binocular- und Display-Funktionalität — Design/Verhalten dort ist **abgestimmt**, siehe Migrations-Prinzip oben.

- `frontend/src/routes/binocular/[event_token]/[scheibennummer]/+page.svelte` — Spotter-UI (Keypad, Satz-Anzeige, Korrektur/Undo)
- `frontend/src/routes/display/+page.svelte` + `frontend/src/lib/components/MonitorTeamBlock.svelte` — Zuschauer-Bildschirm (Pairing, Monitor-Status-Anzeige)
- `frontend/src/lib/api/binocular.ts`, `frontend/src/lib/api/display.ts`, `frontend/src/lib/api/score.ts` — Response-Shapes als Vorlage für eigene API-Typen
- `backend/core/api.py`: `_derive_monitor_status()`, `_build_display_side()`, `BinocularController`, `DisplayController` — serverseitige Zustandslogik hinter beiden Seiten
- `backend/core/models.py`: `Display`-Modell (`pairing_code`, `display_token`, `scheibe_a`/`scheibe_b`)
- `CLAUDE.md` dort dokumentiert das volle Datenmodell (`EventConnection` → `BegegnungSession` → `MatchSession`) und die Zustandsmaschine `LOCKED → ACTIVE → COMPLETED`

### `/home/gero/PycharmProjects/liga/frontend/src/routes/beamer/[veranstaltung_id]` — Tabellenansicht-Design

Referenz für den „Tabelle"-Anzeigemodus, siehe Abschnitt oben. Eigenständige, ungepairte Route dort (`veranstaltung_id` direkt in der URL, kein Pairing) — für ArchScore vermutlich nur das **Rendering-Design** übernehmen, nicht den Zugriffsmechanismus (der läuft hier über das gepairte Display).

### `/home/gero/Downloads/Spotter-Bildschirm/` — Mockups & Ablauf-Entwürfe (Diskussionsstand, nicht abgestimmt)

Skizzen für Admin-UI, die es in `scoring` noch nicht gibt (Veranstaltungs-Setup, Matchkontrolle, Bildschirm-/Tablet-Verwaltung) sowie `Ablauf.md` mit drei Sequenzdiagramm-Varianten (ohne externes System / mit Liga-App / mit Liga-App + separater Schusszettel-App). Explizit als Entwurf markiert — Design-Richtung, keine feste Vorgabe wie beim Referenzprojekt oben.

- `1-Mockup-...-Veranstaltung-Uebersicht.png` … `5Mockup-...-Bildschirm und Tablet.png` — Admin-UI-Mockups in Reihenfolge des Setup-Flows
- `Ablauf.md` — die drei Sequenzdiagramme
- `Schützenmeldung.png`, `Treffereingabe.png`, `Treffereingabe-Fertig.png`, `Match-Beendet.png` — Zusatz-Mockups für Display-Zustände, decken sich weitgehend mit dem bereits gebauten `MonitorTeamBlock.svelte` im `scoring`-Projekt
