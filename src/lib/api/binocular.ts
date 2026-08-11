import { apiClient } from './client';

/**
 * Shapes 1:1 an das `scoring`-Referenzprojekt (`frontend/src/lib/api/binocular.ts`) angelehnt,
 * siehe FACHLICHKEIT.md "Migrations-Prinzip" — MIT einer bewussten Auslassung: kein
 * `ohne_digitale_meldung`-Feld/-Parameter. Dieser Fall wird zentral in der Admin-Oberfläche
 * (Ligaverwaltungs-Verbindung) abgefragt und vom Backend gespeichert, siehe Issue #4.
 *
 * Auth-Modell weicht bewusst von Display (#1, JWT im Authorization-Header) ab: der Token
 * steht im URL-Pfad (wie im Referenzprojekt), kein Header. Als reiner String behandeln,
 * keine UUID-Format-Annahmen — kann später ein JWT werden, ohne dass sich hier etwas ändert.
 */

export interface VorlaeufigePasse {
	position: number;
	lfd_nr: number;
	ringzahl_pfeil1: number | null;
	ringzahl_pfeil2: number | null;
}

export interface BinocularMatch {
	// Erlaubt der UI zu erkennen, dass auf derselben Scheibe ein neues Match aktiv wurde.
	extern_match_id: number;
	status: string;
	mannschaft_name: string;
	gegner_name: string;
	selected_members: number[];
	aktueller_satz: number;
	vorlaeufige_passen: VorlaeufigePasse[];
	schuetze_bestaetigte_saetze: number[];
}

export const binocularApi = {
	getScheibe: (token: string, scheibennummer: number) =>
		apiClient.get<BinocularMatch>(`/binocular/${token}/${scheibennummer}`),

	postPfeil: (token: string, scheibennummer: number, ringzahl: number) =>
		apiClient.post<BinocularMatch>(`/binocular/${token}/${scheibennummer}/pfeil`, { ringzahl }),

	postUndo: (token: string, scheibennummer: number) =>
		apiClient.post<BinocularMatch>(`/binocular/${token}/${scheibennummer}/undo`, {}),

	// Antwort ist keine BinocularMatch-Schema — wird nur zur Erfolgsprüfung genutzt.
	postBestaetigeSatz: (token: string, scheibennummer: number) =>
		apiClient.post<unknown>(`/binocular/${token}/${scheibennummer}/bestaetige_satz`, {})
};
