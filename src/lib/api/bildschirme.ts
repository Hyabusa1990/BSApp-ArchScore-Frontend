import { apiClient } from './client';

/**
 * Bildschirm- und Tablet-Verwaltung, siehe FACHLICHKEIT.md "Bildschirm-Pairing"/
 * "Tablet-Pairing". Displays werden paarweise pro Scheiben-Paar mit PIN verwaltet
 * (`Bildschirm`); Tablets pro einzelner Scheibe über einen QR-Code-Token (`TabletPairing`)
 * — zwei unabhängige Pairing-Mechanismen, nicht verwechseln.
 */

export interface Bildschirm {
	id: string;
	veranstaltung_id: string;
	/** null bei freien Zusatz-Bildschirmen ohne festes Scheiben-Paar (z. B. "Beamer"). */
	scheibe_a: number | null;
	scheibe_b: number | null;
	/** Freier Name — nur bei Zusatz-Bildschirmen gesetzt, sonst null (Anzeige dann "Scheibe X+Y"). */
	name: string | null;
	pin: string;
	aktiv: boolean;
	mode: 'ergebnisse' | 'tabelle';
}

export interface TabletPairing {
	scheibennummer: number;
	token: string;
}

export interface UpdateBildschirmData {
	pin?: string;
	aktiv?: boolean;
	mode?: Bildschirm['mode'];
}

export const bildschirmeApi = {
	list: (token: string, veranstaltungId: string) =>
		apiClient.get<Bildschirm[]>(`/veranstaltungen/${veranstaltungId}/bildschirme`, token),

	update: (
		token: string,
		veranstaltungId: string,
		bildschirmId: string,
		data: UpdateBildschirmData
	) =>
		apiClient.patch<Bildschirm>(
			`/veranstaltungen/${veranstaltungId}/bildschirme/${bildschirmId}`,
			data,
			token
		),

	// "Bildschirm hinzufügen": freier Zusatz-Bildschirm ohne festes Scheiben-Paar.
	create: (token: string, veranstaltungId: string, name: string) =>
		apiClient.post<Bildschirm>(`/veranstaltungen/${veranstaltungId}/bildschirme`, { name }, token),

	generateTabletToken: (token: string, veranstaltungId: string, scheibennummer: number) =>
		apiClient.post<TabletPairing>(
			`/veranstaltungen/${veranstaltungId}/tablet-token`,
			{ scheibennummer },
			token
		)
};
