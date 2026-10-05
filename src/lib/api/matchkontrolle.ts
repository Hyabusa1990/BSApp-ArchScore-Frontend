import { apiClient } from './client';
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
 * client-seitig aus Spotter-Rohdaten nachzurechnen), und der einzige weitere ungenutzte
 * `DosController`-Endpunkt (`PUT .../sets/{setNo}/score`) gehört zur bewusst nicht gebauten
 * Kampfrichter-Rolle (FACHLICHKEIT.md) — für dieses Frontend irrelevant.
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
	targets: RoundTarget[] | null;
}

/** scheibennummer -> ob der Spotter dieser Scheibe den aktuellen Satz bereits bestätigt hat. */
export type ConfirmStatus = Record<number, boolean>;

/** Sicherheitsnetz für `loadRounds`, falls das Backend nie eine leere Runde liefert (8 Mannschaften
 * = 7 Runden, größere Ligen gibt es in dieser App nicht). */
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

	// Es gibt keinen Endpunkt für die Rundenzahl und keinen Lese-Endpunkt für den Spielplan
	// (Backend-Dev, 2026-09-28): ab `roundNo` 1 hochzählen, bis eine Runde ohne Scheiben kommt.
	// Live bestätigt (2026-10-05): Fawkes antwortet auf eine nicht existierende Runde mit 200 und
	// `targets: []`, nicht mit 404. Sequenziell statt parallel, weil das Ende erst bekannt ist,
	// wenn die erste leere Runde da ist.
	loadRounds: async (token: string, fixtureId: number): Promise<RoundInfo[]> => {
		const rounds: RoundInfo[] = [];
		for (let roundNo = 1; roundNo <= MAX_ROUNDS; roundNo++) {
			const round = await matchkontrolleApi.getRound(token, fixtureId, roundNo);
			if (!round.targets?.length) break;
			rounds.push(round);
		}
		return rounds;
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

	getPhase: (token: string, fixtureId: number) =>
		apiClient.get<Phase>(`/fixtures/${fixtureId}/phase`, token),

	// Setzt ausschließlich roundNo — keine Satz-Auswahl mehr bei der Freigabe selbst (#10).
	setPhase: (token: string, fixtureId: number, roundNo: number) =>
		apiClient.put<Phase>(`/fixtures/${fixtureId}/phase`, { roundNo }, token),

	// Kein eigener Matchkontrolle-Endpunkt für Confirm-Status in Fawkes — liest ihn pro
	// Scheibe über denselben (Bearer-freien) Spotter-Info-Call wie die Binocular-Seite selbst
	// (`GetTargetResponse.isConfirmed`), adressiert über die fixtureUniqueId der Veranstaltung.
	getConfirmStatus: async (
		fixtureUniqueId: string,
		scheibennummern: number[]
	): Promise<ConfirmStatus> => {
		const entries = await Promise.all(
			scheibennummern.map(async (nummer) => {
				try {
					const md = await binocularApi.getScheibe(fixtureUniqueId, nummer);
					return [nummer, md.isConfirmed] as const;
				} catch {
					// Scheibe hat aktuell keine Spotter-Info (z. B. noch WARTET) — als
					// unbestätigt behandeln statt die ganze Übersicht abzubrechen.
					return [nummer, false] as const;
				}
			})
		);
		return Object.fromEntries(entries);
	}
};
