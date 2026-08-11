import type { VorlaeufigePasse } from '$lib/api/binocular';
import { loadState, saveState } from './persist';

/**
 * Geteilter Pfeil-/Satz-Zustand pro Scheibe — von Binocular (#4/#5) UND Display (#1–#3)
 * gelesen/geschrieben, siehe Issue #10. Das Admin-Verwaltungs-Modell (#6–#9) kennt nur
 * "welches Match ist aktiv" (Match/Begegnung), nicht den laufenden Pfeilstand — der lebt
 * ausschließlich hier.
 *
 * Über `localStorage` persistiert (siehe persist.ts): Spotter-Tablet und Display laufen in
 * der Realität auf verschiedenen Geräten, im Dev-Setup simuliert durch verschiedene
 * Browser-Tabs — ohne Persistenz sähe jeder Tab nur seinen eigenen, leeren Zustand.
 */

export interface ScheibenScoringState {
	/** Admin-Match-ID (aus veranstaltungen.ts) — zur Rundenwechsel-Erkennung. */
	matchKey: string;
	/** Eindeutige Kennung pro Scheibe/Match — ersetzt das extern_match_id aus dem
	 * Referenzprojekt (das Admin-Modell hier hat keine externe Match-ID), dient nur der
	 * frontendseitigen Rundenwechsel-Erkennung (siehe binocular/+page.svelte). */
	externMatchId: number;
	aktueller_satz: number;
	vorlaeufige_passen: VorlaeufigePasse[];
	schuetze_bestaetigte_saetze: number[];
}

const STORAGE_KEY = 'scoring';

function load(): [number, ScheibenScoringState][] {
	return loadState(STORAGE_KEY, () => []);
}

function persist(entries: [number, ScheibenScoringState][]): void {
	saveState(STORAGE_KEY, entries);
}

/** Holt den Scoring-Zustand einer Scheibe, erzeugt ihn bei Rundenwechsel (neues Match auf
 * dieser Scheibe, erkannt am geänderten matchKey) automatisch frisch. */
export function getScoringState(scheibennummer: number, matchKey: string): ScheibenScoringState {
	const entries = load();
	const existing = entries.find(([nummer]) => nummer === scheibennummer)?.[1];
	if (existing && existing.matchKey === matchKey) return existing;

	const fresh: ScheibenScoringState = {
		matchKey,
		externMatchId: Date.now(),
		aktueller_satz: 1,
		vorlaeufige_passen: [],
		schuetze_bestaetigte_saetze: []
	};
	const next = entries.filter(([nummer]) => nummer !== scheibennummer);
	next.push([scheibennummer, fresh]);
	persist(next);
	return fresh;
}

/** Wie getScoringState, aber erzeugt nichts neu — für lesende Konsumenten (Display), die
 * keinen Zustand für eine Scheibe anlegen sollen, die der Spotter noch nie geöffnet hat. */
export function peekScoringState(scheibennummer: number): ScheibenScoringState | undefined {
	return load().find(([nummer]) => nummer === scheibennummer)?.[1];
}

/** Schreibt einen (vom Aufrufer mutierten) Scoring-Zustand zurück — Mutationsfunktionen in
 * binoculars.ts holen sich den Zustand über getScoringState, ändern ihn und rufen das hier
 * auf, damit die Änderung tab-übergreifend sichtbar wird. */
export function saveScoringState(scheibennummer: number, state: ScheibenScoringState): void {
	const entries = load().filter(([nummer]) => nummer !== scheibennummer);
	entries.push([scheibennummer, state]);
	persist(entries);
}

function ringSumme(passen: VorlaeufigePasse[], lfdNr: number): number {
	return passen
		.filter((p) => p.lfd_nr === lfdNr)
		.reduce((sum, p) => sum + (p.ringzahl_pfeil1 ?? 0) + (p.ringzahl_pfeil2 ?? 0), 0);
}

export interface SatzErgebnisPaar {
	lfd_nr: number;
	ringeA: number;
	ringeB: number;
}

export interface MatchStand {
	satzpunkteA: number;
	satzpunkteB: number;
	fertigeSaetze: number;
	ergebnisse: SatzErgebnisPaar[];
	/** Match beendet: eine Seite hat ≥6 Satzpunkte, oder nach 5 Sätzen steht es 5:5. */
	beendet: boolean;
}

/**
 * Satzpunkte-Regel (siehe FACHLICHKEIT.md): 2 Punkte für mehr Ringe im Satz, bei Gleichstand
 * 1:1. Match beendet bei ≥6 Satzpunkten einer Seite oder 5:5 nach 5 Sätzen (dann Stechen —
 * dessen Ablauf ist fachlich noch nicht vertieft, hier nur als "beendet" markiert).
 *
 * Ein Satz zählt hier erst als "fertig", sobald BEIDE Spotter ihn bestätigt haben
 * (aktueller_satz > lfd_nr auf beiden Scheiben) — der Fortschritt bleibt sonst bewusst pro
 * Spotter unabhängig, siehe FACHLICHKEIT.md Spotter-Workflow.
 */
export function berechneMatchStand(scheibeA: number, scheibeB: number): MatchStand {
	const stateA = peekScoringState(scheibeA);
	const stateB = peekScoringState(scheibeB);
	const fertigeSaetze = Math.min(stateA?.aktueller_satz ?? 1, stateB?.aktueller_satz ?? 1) - 1;

	let satzpunkteA = 0;
	let satzpunkteB = 0;
	const ergebnisse: SatzErgebnisPaar[] = [];
	for (let lfdNr = 1; lfdNr <= fertigeSaetze; lfdNr++) {
		const ringeA = ringSumme(stateA?.vorlaeufige_passen ?? [], lfdNr);
		const ringeB = ringSumme(stateB?.vorlaeufige_passen ?? [], lfdNr);
		if (ringeA > ringeB) satzpunkteA += 2;
		else if (ringeB > ringeA) satzpunkteB += 2;
		else {
			satzpunkteA += 1;
			satzpunkteB += 1;
		}
		ergebnisse.push({ lfd_nr: lfdNr, ringeA, ringeB });
	}

	const beendet =
		satzpunkteA >= 6 ||
		satzpunkteB >= 6 ||
		(fertigeSaetze >= 5 && satzpunkteA === 5 && satzpunkteB === 5);

	return { satzpunkteA, satzpunkteB, fertigeSaetze, ergebnisse, beendet };
}
