import type { BinocularMatch } from '$lib/api/binocular';

/**
 * In-memory Fake-Backend-Zustand für Binocular — eigener Store, bewusst nicht geteilt mit
 * `db.ts` oder `displays.ts` (jedes Feature-Modul bleibt eigenständig, siehe Issue #10).
 *
 * Anders als bei Display (#1) gibt es hier KEINEN Registrierungs-Endpoint: Tablet-Tokens
 * werden laut FACHLICHKEIT.md vom Admin generiert (QR-Code pro Scheibe, kommt erst mit #9).
 * Bis dahin: vier feste, dokumentierte Demo-Tokens zum manuellen Testen ohne Admin-UI.
 */

interface BinocularRecord {
	scheibennummer: number;
	/** null = kein aktives Match auf dieser Scheibe (WARTET-Zustand). */
	match: BinocularMatch | null;
}

export const DEMO_TOKEN_SCHEIBE_1 = 'binocular-demo-scheibe-1';
export const DEMO_TOKEN_SCHEIBE_2 = 'binocular-demo-scheibe-2';
export const DEMO_TOKEN_WARTET = 'binocular-demo-wartet';
export const DEMO_TOKEN_COMPLETED = 'binocular-demo-completed';

const records = new Map<string, BinocularRecord>([
	[
		DEMO_TOKEN_SCHEIBE_1,
		{
			scheibennummer: 1,
			match: {
				extern_match_id: 1001,
				status: 'ACTIVE',
				mannschaft_name: 'BSC Ostermorgen',
				gegner_name: 'SV Altheim-Waldhausen',
				selected_members: [1, 2, 3],
				aktueller_satz: 1,
				vorlaeufige_passen: [],
				schuetze_bestaetigte_saetze: []
			}
		}
	],
	[
		DEMO_TOKEN_SCHEIBE_2,
		{
			scheibennummer: 2,
			match: {
				extern_match_id: 1001,
				status: 'ACTIVE',
				mannschaft_name: 'SV Altheim-Waldhausen',
				gegner_name: 'BSC Ostermorgen',
				selected_members: [4, 5, 6],
				aktueller_satz: 1,
				vorlaeufige_passen: [],
				schuetze_bestaetigte_saetze: []
			}
		}
	],
	[DEMO_TOKEN_WARTET, { scheibennummer: 3, match: null }],
	[
		DEMO_TOKEN_COMPLETED,
		{
			scheibennummer: 4,
			match: {
				extern_match_id: 999,
				status: 'COMPLETED',
				mannschaft_name: 'BSC Abendau',
				gegner_name: 'SV Scharfhaus',
				selected_members: [1, 2, 3],
				aktueller_satz: 6,
				vorlaeufige_passen: [],
				schuetze_bestaetigte_saetze: [1, 2, 3, 4, 5]
			}
		}
	]
]);

type ResolveResult =
	| { kind: 'invalid-token' }
	| { kind: 'no-match' }
	| { kind: 'ok'; match: BinocularMatch };

function resolve(token: string, scheibennummer: number): ResolveResult {
	const record = records.get(token);
	if (!record) return { kind: 'invalid-token' };
	if (!record.match || record.scheibennummer !== scheibennummer) return { kind: 'no-match' };
	return { kind: 'ok', match: record.match };
}

export function getScheibe(token: string, scheibennummer: number): ResolveResult {
	return resolve(token, scheibennummer);
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
	const outcome = resolve(token, scheibennummer);
	if (outcome.kind !== 'ok') return outcome;

	const match = outcome.match;
	const lfdNr = match.aktueller_satz;
	const count = pfeileInSatz(match.vorlaeufige_passen, lfdNr);
	if (count >= 6) return outcome; // Satz bereits voll — UI verhindert das clientseitig ohnehin

	const position = Math.floor(count / 2) + 1;
	let passe = match.vorlaeufige_passen.find((p) => p.lfd_nr === lfdNr && p.position === position);
	if (!passe) {
		passe = { position, lfd_nr: lfdNr, ringzahl_pfeil1: null, ringzahl_pfeil2: null };
		match.vorlaeufige_passen.push(passe);
	}
	if (passe.ringzahl_pfeil1 === null) passe.ringzahl_pfeil1 = ringzahl;
	else passe.ringzahl_pfeil2 = ringzahl;

	return outcome;
}

export function undoLast(token: string, scheibennummer: number): ResolveResult {
	const outcome = resolve(token, scheibennummer);
	if (outcome.kind !== 'ok') return outcome;

	const match = outcome.match;
	const lfdNr = match.aktueller_satz;
	const passenInSatz = match.vorlaeufige_passen
		.filter((p) => p.lfd_nr === lfdNr)
		.sort((a, b) => b.position - a.position);

	for (const p of passenInSatz) {
		if (p.ringzahl_pfeil2 !== null) {
			p.ringzahl_pfeil2 = null;
			return outcome;
		}
		if (p.ringzahl_pfeil1 !== null) {
			p.ringzahl_pfeil1 = null;
			match.vorlaeufige_passen = match.vorlaeufige_passen.filter((x) => x !== p);
			return outcome;
		}
	}
	return outcome; // nichts zum Zurücknehmen
}

export function bestaetigeSatz(token: string, scheibennummer: number): ResolveResult {
	const outcome = resolve(token, scheibennummer);
	if (outcome.kind !== 'ok') return outcome;

	const match = outcome.match;
	if (!match.schuetze_bestaetigte_saetze.includes(match.aktueller_satz)) {
		match.schuetze_bestaetigte_saetze.push(match.aktueller_satz);
	}
	match.aktueller_satz += 1;
	return outcome;
}
