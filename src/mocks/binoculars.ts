import { decodeShot, encodeShot, type BinocularMatch } from '$lib/api/binocular';
import {
	findAktivesMatchFuerScheibe,
	findTabletPairing,
	findVeranstaltungByFixtureUniqueId,
	mannschaftUndGegner,
	type AktivesMatchFuerScheibe
} from './veranstaltungen';
import {
	berechneMatchStand,
	getScoringState,
	saveScoringState,
	type ScheibenScoringState
} from './shared-state';

/**
 * Auflösung jetzt über den echten Admin-Verwaltungs-Mock (#6–#9) statt eigener Demo-Tokens —
 * siehe Issue #10. Tablet-Tokens kommen aus der Bildschirm-/Tablet-Verwaltung (#9), das
 * aktive Match aus der Matchkontrolle (#8). Der laufende Pfeil-/Satz-Fortschritt lebt
 * weiterhin separat (im geteilten `shared-state.ts`), weil das Admin-Modell keine laufenden
 * Scoring-Daten kennt — nur "welches Match ist aktiv".
 */

interface Resolved {
	found: AktivesMatchFuerScheibe;
	scoring: ScheibenScoringState;
}

type ResolveOutcome =
	| { kind: 'invalid-token' }
	| { kind: 'no-match' }
	| { kind: 'ok'; resolved: Resolved };

// Zwei gültige Token-Arten für denselben Spotter-Info-Call: das Tablet-Pairing-Token (echte
// Spotter-Seite, ein Token pro Scheibe) oder die fixtureUniqueId der Veranstaltung (Matchkontrolle
// ruft #10 denselben Endpunkt direkt auf, um den Confirm-Status pro Scheibe zu lesen — echter
// Fawkes-Kontrakt, kein Tablet-Pairing nötig).
function resolvePairing(token: string, scheibennummer: number): ResolveOutcome {
	const gueltigerToken =
		findTabletPairing(token)?.scheibennummer === scheibennummer ||
		findVeranstaltungByFixtureUniqueId(token) !== undefined;
	if (!gueltigerToken) return { kind: 'invalid-token' };

	const found = findAktivesMatchFuerScheibe(scheibennummer);
	if (!found) return { kind: 'no-match' };

	return {
		kind: 'ok',
		resolved: { found, scoring: getScoringState(scheibennummer, found.match.id) }
	};
}

/** Passen des aktuellen Satzes, Position-sortiert, -> Fawkes-shots-String (siehe binocular.ts). */
function encodeShots(passenImSatz: BinocularMatch['vorlaeufige_passen']): string {
	const sortiert = [...passenImSatz].sort((a, b) => a.position - b.position);
	const chars: string[] = [];
	for (const p of sortiert) {
		if (p.ringzahl_pfeil1 !== null) chars.push(encodeShot(p.ringzahl_pfeil1));
		if (p.ringzahl_pfeil2 !== null) chars.push(encodeShot(p.ringzahl_pfeil2));
	}
	return chars.join('');
}

function buildMatch(scheibennummer: number, { found, scoring }: Resolved): BinocularMatch {
	const gegnerScheibe = found.seite === 'a' ? found.begegnung.scheibe_b : found.begegnung.scheibe_a;
	const stand = berechneMatchStand(
		found.seite === 'a' ? scheibennummer : gegnerScheibe,
		found.seite === 'a' ? gegnerScheibe : scheibennummer
	);
	const { mannschaft, gegner } = mannschaftUndGegner(found.begegnung, found.seite);
	// Nur der aktuelle Satz — 1:1 wie im scoring-Referenzprojekt (_binocular_dict filtert
	// dort genauso). scoring.vorlaeufige_passen selbst sammelt alle Sätze (für
	// liveSatzErgebnisse/berechneMatchStand gebraucht), aber die Binocular-UI indiziert
	// Pfeile rein über "position" (1-3) ohne lfd_nr — ungefiltert würden sich mehrere
	// Sätze in der Anzeige überlagern, sobald mehr als ein Satz gelaufen ist.
	const passenImSatz = scoring.vorlaeufige_passen.filter(
		(p) => p.lfd_nr === scoring.aktueller_satz
	);

	return {
		extern_match_id: scoring.externMatchId,
		status: stand.beendet ? 'COMPLETED' : 'ACTIVE',
		mannschaft_name: mannschaft,
		gegner_name: gegner,
		// Admin-Modell kennt keine Schützen-Aufstellung pro Begegnung — bewusst leer.
		selected_members: [],
		aktueller_satz: scoring.aktueller_satz,
		vorlaeufige_passen: passenImSatz,
		schuetze_bestaetigte_saetze: scoring.schuetze_bestaetigte_saetze,
		shots: encodeShots(passenImSatz),
		isConfirmed: scoring.schuetze_bestaetigte_saetze.includes(scoring.aktueller_satz)
	};
}

type ResolveResult =
	| { kind: 'invalid-token' }
	| { kind: 'no-match' }
	| { kind: 'ok'; match: BinocularMatch };

export function getScheibe(token: string, scheibennummer: number): ResolveResult {
	const outcome = resolvePairing(token, scheibennummer);
	if (outcome.kind !== 'ok') return outcome;
	return { kind: 'ok', match: buildMatch(scheibennummer, outcome.resolved) };
}

/** Fawkes-shots-String -> Passen des aktuellen Satzes (Gegenrichtung zu encodeShots). */
function decodeShots(shots: string, lfdNr: number): BinocularMatch['vorlaeufige_passen'] {
	const passen: BinocularMatch['vorlaeufige_passen'] = [];
	for (let i = 0; i < shots.length; i++) {
		const position = Math.floor(i / 2) + 1;
		let passe = passen.find((p) => p.position === position);
		if (!passe) {
			passe = { position, lfd_nr: lfdNr, ringzahl_pfeil1: null, ringzahl_pfeil2: null };
			passen.push(passe);
		}
		const ringzahl = decodeShot(shots[i]);
		if (i % 2 === 0) passe.ringzahl_pfeil1 = ringzahl;
		else passe.ringzahl_pfeil2 = ringzahl;
	}
	return passen;
}

// PUT .../spotter/shots überschreibt den kompletten shots-String des aktuellen Satzes bei
// jedem Aufruf (kein separater Einzelpfeil-/Undo-Endpunkt) — ersetzt die bisherigen
// applyPfeil/undoLast: der übergebene String wird komplett neu dekodiert und die Passen des
// aktuellen Satzes werden vollständig ersetzt.
export function setShots(token: string, scheibennummer: number, shots: string): ResolveResult {
	const outcome = resolvePairing(token, scheibennummer);
	if (outcome.kind !== 'ok') return outcome;

	const { scoring } = outcome.resolved;
	const lfdNr = scoring.aktueller_satz;
	scoring.vorlaeufige_passen = [
		...scoring.vorlaeufige_passen.filter((p) => p.lfd_nr !== lfdNr),
		...decodeShots(shots, lfdNr)
	];

	saveScoringState(scheibennummer, scoring);
	return { kind: 'ok', match: buildMatch(scheibennummer, outcome.resolved) };
}

export function bestaetigeSatz(token: string, scheibennummer: number): ResolveResult {
	const outcome = resolvePairing(token, scheibennummer);
	if (outcome.kind !== 'ok') return outcome;

	const { scoring } = outcome.resolved;
	if (!scoring.schuetze_bestaetigte_saetze.includes(scoring.aktueller_satz)) {
		scoring.schuetze_bestaetigte_saetze.push(scoring.aktueller_satz);
	}
	scoring.aktueller_satz += 1;

	saveScoringState(scheibennummer, scoring);
	return { kind: 'ok', match: buildMatch(scheibennummer, outcome.resolved) };
}
