import { apiClient } from './client';

/**
 * Shapes angelehnt an das `scoring`-Referenzprojekt (`frontend/src/lib/api/display.ts`),
 * siehe FACHLICHKEIT.md "Migrations-Prinzip". Erweitert um `mode`/`paired`/`tabelle` sowie
 * `TabellenEintrag` (Shape aus dem `liga`-Referenzprojekt), da diese App zusätzlich zur
 * Trefferanzeige eine Tabellenansicht kennt.
 *
 * Auth weicht bewusst vom Referenzprojekt ab: JWT + 6-stelliger PIN statt reiner UUID
 * (`display_token`). Das JWT wird wie ein normaler Access-Token an `apiClient` übergeben.
 */

export interface DisplayCreateResponse {
	jwt: string;
	pin: string;
}

export interface DisplayPfeil {
	position: number;
	name: string;
	ringzahl_pfeil1: number | null;
	ringzahl_pfeil2: number | null;
}

export interface SatzErgebnis {
	lfd_nr: number;
	eigene_ringe: number;
	gegner_ringe: number | null;
	eigene_strafpunkte: number;
	gegner_strafpunkte: number | null;
	beide_eingegeben: boolean;
}

export interface DisplaySeite {
	scheibennummer: number | null;
	mannschaft_name: string | null;
	monitor_status: 'WARTET' | 'SCHUETZEN_GEMELDET' | 'SATZ_LAEUFT' | 'SATZ_FERTIG' | 'MATCH_FERTIG';
	schuetzen: string[];
	aktueller_satz: number | null;
	pfeile: DisplayPfeil[];
	satz_ergebnisse: SatzErgebnis[];
	matchpunkte: number | null;
	satzpunkte: number | null;
}

export interface TabellenEintrag {
	mannschaft_id: number;
	mannschaft_name: string;
	matchpunkte: number;
	matchpunkte_neg: number;
	satzpunkte_netto: number;
}

export interface DisplayContent {
	paired: boolean;
	mode: 'ergebnisse' | 'tabelle';
	scheibe_a: DisplaySeite | null;
	scheibe_b: DisplaySeite | null;
	/** Nur gesetzt, wenn mode === 'tabelle'. */
	tabelle?: TabellenEintrag[];
}

export const displayApi = {
	register: () => apiClient.post<DisplayCreateResponse>('/display/register', {}),

	getContent: (jwt: string) => apiClient.get<DisplayContent>('/display/content', jwt)
};
