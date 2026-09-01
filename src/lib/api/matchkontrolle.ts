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

/** scheibennummer -> ob der Spotter dieser Scheibe den aktuellen Satz bereits bestätigt hat. */
export type ConfirmStatus = Record<number, boolean>;

export const matchkontrolleApi = {
	list: (token: string, veranstaltungId: string) =>
		apiClient.get<Match[]>(
			`/veranstaltungen/${encodeURIComponent(veranstaltungId)}/matches`,
			token
		),

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
