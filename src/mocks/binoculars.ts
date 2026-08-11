import type { BinocularMatch } from '$lib/api/binocular';
import {
	findAktivesMatchFuerScheibe,
	findTabletPairing,
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

function resolvePairing(token: string, scheibennummer: number): ResolveOutcome {
	const pairing = findTabletPairing(token);
	if (!pairing || pairing.scheibennummer !== scheibennummer) return { kind: 'invalid-token' };

	const found = findAktivesMatchFuerScheibe(scheibennummer);
	if (!found) return { kind: 'no-match' };

	return {
		kind: 'ok',
		resolved: { found, scoring: getScoringState(scheibennummer, found.match.id) }
	};
}

function buildMatch(scheibennummer: number, { found, scoring }: Resolved): BinocularMatch {
	const gegnerScheibe = found.seite === 'a' ? found.begegnung.scheibe_b : found.begegnung.scheibe_a;
	const stand = berechneMatchStand(
		found.seite === 'a' ? scheibennummer : gegnerScheibe,
		found.seite === 'a' ? gegnerScheibe : scheibennummer
	);
	const { mannschaft, gegner } = mannschaftUndGegner(found.begegnung, found.seite);

	return {
		extern_match_id: scoring.externMatchId,
		status: stand.beendet ? 'COMPLETED' : 'ACTIVE',
		mannschaft_name: mannschaft,
		gegner_name: gegner,
		// Admin-Modell kennt keine Schützen-Aufstellung pro Begegnung — bewusst leer.
		selected_members: [],
		aktueller_satz: scoring.aktueller_satz,
		vorlaeufige_passen: scoring.vorlaeufige_passen,
		schuetze_bestaetigte_saetze: scoring.schuetze_bestaetigte_saetze
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

function pfeileInSatz(passen: BinocularMatch['vorlaeufige_passen'], lfdNr: number): number {
	return passen
		.filter((p) => p.lfd_nr === lfdNr)
		.reduce(
			(n, p) => n + (p.ringzahl_pfeil1 !== null ? 1 : 0) + (p.ringzahl_pfeil2 !== null ? 1 : 0),
			0
		);
}

export function applyPfeil(token: string, scheibennummer: number, ringzahl: number): ResolveResult {
	const outcome = resolvePairing(token, scheibennummer);
	if (outcome.kind !== 'ok') return outcome;

	const { scoring } = outcome.resolved;
	const lfdNr = scoring.aktueller_satz;
	const count = pfeileInSatz(scoring.vorlaeufige_passen, lfdNr);
	if (count < 6) {
		const position = Math.floor(count / 2) + 1;
		let passe = scoring.vorlaeufige_passen.find(
			(p) => p.lfd_nr === lfdNr && p.position === position
		);
		if (!passe) {
			passe = { position, lfd_nr: lfdNr, ringzahl_pfeil1: null, ringzahl_pfeil2: null };
			scoring.vorlaeufige_passen.push(passe);
		}
		if (passe.ringzahl_pfeil1 === null) passe.ringzahl_pfeil1 = ringzahl;
		else passe.ringzahl_pfeil2 = ringzahl;
	}

	saveScoringState(scheibennummer, scoring);
	return { kind: 'ok', match: buildMatch(scheibennummer, outcome.resolved) };
}

export function undoLast(token: string, scheibennummer: number): ResolveResult {
	const outcome = resolvePairing(token, scheibennummer);
	if (outcome.kind !== 'ok') return outcome;

	const { scoring } = outcome.resolved;
	const lfdNr = scoring.aktueller_satz;
	const passenInSatz = scoring.vorlaeufige_passen
		.filter((p) => p.lfd_nr === lfdNr)
		.sort((a, b) => b.position - a.position);

	for (const p of passenInSatz) {
		if (p.ringzahl_pfeil2 !== null) {
			p.ringzahl_pfeil2 = null;
			break;
		}
		if (p.ringzahl_pfeil1 !== null) {
			p.ringzahl_pfeil1 = null;
			scoring.vorlaeufige_passen = scoring.vorlaeufige_passen.filter((x) => x !== p);
			break;
		}
	}

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
