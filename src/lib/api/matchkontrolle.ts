import { apiClient } from './client';

/**
 * "Match" = Terminologie der Verwaltungsoberfläche für das, was im scoring-Referenzprojekt
 * "Runde" heißt: mehrere gleichzeitige Begegnungen, mehrere Scheiben parallel im Einsatz.
 * Siehe FACHLICHKEIT.md "Veranstaltungs-Setup und Admin-Workflow". Genau ein Match pro
 * Veranstaltung ist immer aktiv — wird serverseitig/im Mock erzwungen, nicht hier.
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

export const matchkontrolleApi = {
	list: (token: string, veranstaltungId: string) =>
		apiClient.get<Match[]>(`/veranstaltungen/${veranstaltungId}/matches`, token),

	// Aktiviert das gewählte Match, deaktiviert automatisch jedes andere der Veranstaltung.
	// Antwort ist die vollständige, aktualisierte Liste (nicht nur das eine Match).
	activate: (token: string, veranstaltungId: string, matchId: string) =>
		apiClient.post<Match[]>(
			`/veranstaltungen/${veranstaltungId}/matches/${matchId}/activate`,
			{},
			token
		)
};
