import { apiClient, APIError } from './client';
import { binocularApi } from './binocular';

/**
 * "Match" = Terminologie der Verwaltungsoberfläche für das, was im scoring-Referenzprojekt
 * "Runde" heißt: mehrere gleichzeitige Begegnungen, mehrere Scheiben parallel im Einsatz.
 * Siehe FACHLICHKEIT.md "Veranstaltungs-Setup und Admin-Workflow". Genau ein Match pro
 * Veranstaltung ist immer aktiv — wird serverseitig/im Mock erzwungen, nicht hier.
 *
 * Freigabe läuft seit #10 (korrigiert #5/#7/#8) über den echten Fawkes-`DosController` —
 * `PUT/GET /fixtures/{fixtureId}/phase`, nur `roundNo` (= `Match.nummer`), kein `setNo` mehr.
 * Das Backend leitet den Satz-Fortschritt selbst aus den Spotter-Confirms ab.
 *
 * `list()` lief bis Issue #22 über einen komplett erfundenen `/veranstaltungen/{id}/matches`-
 * Pfad, den es in `docs/Fawkes-OpenApi.json` nie gab. Die echte API kennt dafür nur
 * `GET /fixtures/{fixtureId}/rounds/{roundNo}` (`DosController.GetRoundResponse`) — eine Runde
 * pro Aufruf, als flache Scheiben-Liste (`TargetInformation[]`), keine gepaarten Begegnungen,
 * und keinen Endpunkt, der die Gesamtzahl der Runden nennt. Geklärt mit Gero (2026-09-04):
 * Satzpunkte werden serverseitig berechnet (nicht mehr
 * client-seitig aus Spotter-Rohdaten nachzurechnen). `PUT .../sets/{setNo}/score` wird seit
 * 2026-10-26 für die Satzsummen-Korrektur der Turnierleitung genutzt (`setSetScore`).
 *
 * Seit 2026-10-05 (Backend-Commit `19abb9ea`) liefern beide `DosController`-Rundenendpunkte
 * echte Daten: `GET .../rounds/{roundNo}` und `PUT .../sets/{setNo}/score` (Body nur noch
 * `{score: number | null}`, `confirmed` entfällt).
 */

export interface Begegnung {
	scheibe_a: number;
	scheibe_b: number;
	mannschaft_a: string;
	mannschaft_b: string;
}

export interface Match {
	id: string;
	veranstaltung_id: string;
	nummer: number;
	aktiv: boolean;
	begegnungen: Begegnung[];
}

/** `Fawkes.Api.Controllers.DosController.GetPhaseResponse`. */
export interface Phase {
	roundNo: number;
	fixtureId: number;
	/** Rundenzahl des Spielplans (0 solange keiner existiert). Seit Backend `e5cef653`. */
	roundCount: number;
}

/** `Fawkes.Api.Controllers.DosController.TargetInformation`. */
export interface RoundTarget {
	targetNo: number;
	teamName: string | null;
	totalSetPoints: number;
	/** `null`-Einträge = Satz noch nicht bestätigt (Stand 2026-10-05, vorher `number[]`). */
	setScores: (number | null)[] | null;
}

/** `Fawkes.Api.Controllers.DosController.GetRoundResponse`. */
export interface RoundInfo {
	fixtureId: number;
	roundNo: number;
	/** Rundenzahl des Spielplans, gültig sind `roundNo` 1..roundCount. Seit Backend `e5cef653`. */
	roundCount: number;
	targets: RoundTarget[] | null;
}

/** Stand einer Scheibe laut Spotter-Info. */
export interface ScheibenStatus {
	currentSetNo: number;
	matchComplete: boolean;
}

/** scheibennummer -> Stand der Scheibe; `null` = keine Spotter-Info (z. B. noch WARTET). */
export type ScheibenStatusMap = Record<number, ScheibenStatus | null>;

/** Obergrenze für `loadRounds` (8 Mannschaften = 7 Runden, größere Ligen gibt es nicht). */
const MAX_ROUNDS = 20;

/** Sortiert die flache Scheiben-Liste einer Runde nach `targetNo` und paart sie gemäß der
 * festen FACHLICHKEIT.md-Konvention (1 gg. 2, 3 gg. 4, ...) zu Begegnungen — die echte API
 * kennt keine Paarung, nur einzelne Scheiben. */
function roundInfoToBegegnungen(targets: RoundTarget[]): Begegnung[] {
	const sortiert = [...targets].sort((a, b) => a.targetNo - b.targetNo);
	const begegnungen: Begegnung[] = [];
	for (let i = 0; i + 1 < sortiert.length; i += 2) {
		begegnungen.push({
			scheibe_a: sortiert[i].targetNo,
			scheibe_b: sortiert[i + 1].targetNo,
			mannschaft_a: sortiert[i].teamName ?? '',
			mannschaft_b: sortiert[i + 1].teamName ?? ''
		});
	}
	return begegnungen;
}

export const matchkontrolleApi = {
	getRound: (token: string, fixtureId: number, roundNo: number) =>
		apiClient.get<RoundInfo>(`/fixtures/${fixtureId}/rounds/${roundNo}`, token),

	// Kein Lese-Endpunkt für den Spielplan: ab `roundNo` 1 laden, `roundCount` der ersten Runde
	// nennt das Ende. Seit Backend `e5cef653` (2026-10-27) antwortet Fawkes außerhalb des
	// Spielplans mit 404 `ROUND_NOT_FOUND` statt 200 mit leerem `targets` — Runde 1 mit 404
	// heißt daher "noch kein Spielplan".
	loadRounds: async (token: string, fixtureId: number): Promise<RoundInfo[]> => {
		let first: RoundInfo;
		try {
			first = await matchkontrolleApi.getRound(token, fixtureId, 1);
		} catch (err) {
			if (err instanceof APIError && err.status === 404) return [];
			throw err;
		}
		if (!first.targets?.length) return [];
		const count = Math.min(first.roundCount || 1, MAX_ROUNDS);
		const rest = await Promise.all(
			Array.from({ length: count - 1 }, (_, i) =>
				matchkontrolleApi.getRound(token, fixtureId, i + 2)
			)
		);
		return [first, ...rest];
	},

	// `aktiv` bleibt hier immer `false`, der Aufrufer mergt es separat über `getPhase` ein
	// (siehe `matchkontrolle/+page.svelte`).
	list: async (token: string, fixtureId: number): Promise<Match[]> => {
		const rounds = await matchkontrolleApi.loadRounds(token, fixtureId);
		return rounds.map((round) => ({
			id: `${round.fixtureId}-${round.roundNo}`,
			veranstaltung_id: String(fixtureId),
			nummer: round.roundNo,
			aktiv: false,
			begegnungen: roundInfoToBegegnungen(round.targets ?? [])
		}));
	},

	// Korrigiert die Satzsumme einer Scheibe (Kampfrichter-Korrektur nach falscher Spotter-
	// Bestätigung); `null` setzt die Summe zurück. Bare 200 ohne Body. `setNo` ab 1.
	setSetScore: (
		token: string,
		fixtureId: number,
		roundNo: number,
		targetNo: number,
		setNo: number,
		score: number | null
	) =>
		apiClient.put<void>(
			`/fixtures/${fixtureId}/rounds/${roundNo}/targets/${targetNo}/sets/${setNo}/score`,
			{ score },
			token
		),

	getPhase: (token: string, fixtureId: number) =>
		apiClient.get<Phase>(`/fixtures/${fixtureId}/phase`, token),

	// Setzt ausschließlich roundNo — keine Satz-Auswahl mehr bei der Freigabe selbst (#10).
	setPhase: (token: string, fixtureId: number, roundNo: number) =>
		apiClient.put<Phase>(`/fixtures/${fixtureId}/phase`, { roundNo }, token),

	// Kein eigener Matchkontrolle-Endpunkt für den Scheibenstand in Fawkes — liest ihn pro
	// Scheibe über denselben (Bearer-freien) Spotter-Info-Call wie die Binocular-Seite selbst
	// (`GetTargetResponse.currentSetNo`/`matchComplete`), adressiert über die fixtureUniqueId.
	getScheibenStatus: async (
		fixtureUniqueId: string,
		scheibennummern: number[]
	): Promise<ScheibenStatusMap> => {
		const entries = await Promise.all(
			scheibennummern.map(async (nummer) => {
				try {
					const md = await binocularApi.getScheibe(fixtureUniqueId, nummer);
					return [
						nummer,
						{ currentSetNo: md.currentSetNo, matchComplete: md.matchComplete }
					] as const;
				} catch {
					// Scheibe hat aktuell keine Spotter-Info — statt die ganze Übersicht abzubrechen
					// ohne Stand anzeigen.
					return [nummer, null] as const;
				}
			})
		);
		return Object.fromEntries(entries);
	}
};
