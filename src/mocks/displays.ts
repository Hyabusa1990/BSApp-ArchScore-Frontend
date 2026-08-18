import type { DisplayContent, DisplayPfeil, DisplaySeite, TabellenEintrag } from '$lib/api/display';
import {
	findAktivesMatchFuerScheibe,
	findBildschirmByPin,
	getMatchPlayChart,
	getVeranstaltungById,
	mannschaftUndGegner
} from './veranstaltungen';
import { berechneMatchStand, liveSatzErgebnisse, peekScoringState } from './shared-state';

/**
 * In-memory Fake-Backend-Zustand für Displays — Pairing/Inhalt kommen jetzt aus dem echten
 * Admin-Verwaltungs-Mock (#6–#9), siehe Issue #10. Ein Display gilt als gepaired, sobald ein
 * Bildschirm-Eintrag (#9) mit passendem PIN existiert — genau das ist der Pairing-Vorgang:
 * der Admin trägt den am Display angezeigten PIN im Bildschirm-Formular ein und speichert.
 * Nur JWT+PIN-Ausstellung selbst bleibt hier (eigenes Auth-Schema, siehe #1).
 */

interface DisplayRecord {
	pin: string;
}

const displays = new Map<string, DisplayRecord>();

function generatePin(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne verwechselbare Zeichen (0/O, 1/I)
	return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function registerDisplay(): { jwt: string; pin: string } {
	const jwt = `mock-display.${crypto.randomUUID()}`;
	const pin = generatePin();
	displays.set(jwt, { pin });
	return { jwt, pin };
}

function leereSeite(scheibennummer: number | null): DisplaySeite {
	return {
		scheibennummer,
		mannschaft_name: null,
		monitor_status: 'WARTET',
		schuetzen: [],
		aktueller_satz: null,
		pfeile: [],
		satz_ergebnisse: [],
		matchpunkte: null,
		satzpunkte: null
	};
}

function buildSeiteForScheibe(scheibennummer: number | null): DisplaySeite {
	if (scheibennummer === null) return leereSeite(null);

	const found = findAktivesMatchFuerScheibe(scheibennummer);
	if (!found) return leereSeite(scheibennummer);

	const { mannschaft } = mannschaftUndGegner(found.begegnung, found.seite);
	const scoringOwn = peekScoringState(scheibennummer);

	// Match aktiv, aber der Spotter hat diese Scheibe noch nie geöffnet / noch keinen Pfeil
	// erfasst — Scoring-Zustand existiert dann noch gar nicht (peekScoringState legt ihn
	// bewusst nicht an, siehe shared-state.ts).
	if (!scoringOwn) {
		return {
			scheibennummer,
			mannschaft_name: mannschaft,
			monitor_status: 'SCHUETZEN_GEMELDET',
			schuetzen: [],
			aktueller_satz: 1,
			pfeile: [],
			satz_ergebnisse: [],
			matchpunkte: null,
			satzpunkte: null
		};
	}

	const gegnerScheibe = found.seite === 'a' ? found.begegnung.scheibe_b : found.begegnung.scheibe_a;
	const stand = berechneMatchStand(
		found.seite === 'a' ? scheibennummer : gegnerScheibe,
		found.seite === 'a' ? gegnerScheibe : scheibennummer
	);
	const eigeneSatzpunkte = found.seite === 'a' ? stand.satzpunkteA : stand.satzpunkteB;

	// Live-Ringsumme für die Anzeige (zeigt den laufenden Satz schon während der Erfassung,
	// nicht erst wenn beide Seiten fertig sind) — bewusst getrennt von berechneMatchStand
	// oben, das für Satzpunkte/Matchende weiterhin streng "beide fertig" verlangt.
	const satzErgebnisse = liveSatzErgebnisse(scheibennummer, gegnerScheibe);

	if (stand.beendet) {
		return {
			scheibennummer,
			mannschaft_name: mannschaft,
			monitor_status: 'MATCH_FERTIG',
			schuetzen: [],
			aktueller_satz: 5,
			pfeile: [],
			satz_ergebnisse: satzErgebnisse,
			matchpunkte: eigeneSatzpunkte,
			satzpunkte: null
		};
	}

	const lfdNr = scoringOwn.aktueller_satz;
	const pfeileImSatz = scoringOwn.vorlaeufige_passen.filter((p) => p.lfd_nr === lfdNr);
	const anzahlPfeileImSatz = pfeileImSatz.reduce(
		(n, p) => n + (p.ringzahl_pfeil1 !== null ? 1 : 0) + (p.ringzahl_pfeil2 !== null ? 1 : 0),
		0
	);

	if (anzahlPfeileImSatz === 0) {
		// lfdNr === 1: frisch gemeldet, noch kein Pfeil. lfdNr > 1: voriger Satz gerade
		// komplett, wartet auf den nächsten — spiegelt _derive_monitor_status im
		// scoring-Referenzprojekt.
		return {
			scheibennummer,
			mannschaft_name: mannschaft,
			monitor_status: lfdNr === 1 ? 'SCHUETZEN_GEMELDET' : 'SATZ_FERTIG',
			schuetzen: [],
			aktueller_satz: lfdNr,
			pfeile: [],
			satz_ergebnisse: satzErgebnisse,
			matchpunkte: null,
			satzpunkte: lfdNr > 1 ? eigeneSatzpunkte : null
		};
	}

	const pfeile: DisplayPfeil[] = pfeileImSatz.map((p) => ({
		position: p.position,
		name: `Position ${p.position}`,
		ringzahl_pfeil1: p.ringzahl_pfeil1,
		ringzahl_pfeil2: p.ringzahl_pfeil2
	}));

	return {
		scheibennummer,
		mannschaft_name: mannschaft,
		monitor_status: 'SATZ_LAEUFT',
		schuetzen: [],
		aktueller_satz: lfdNr,
		pfeile,
		satz_ergebnisse: satzErgebnisse,
		matchpunkte: null,
		satzpunkte: null
	};
}

// Seit Issue #14 kommt die Tabelle aus der separaten MatchPlayChart-Ressource (echter
// Fawkes-Kontrakt), nicht mehr embedded auf der Veranstaltung selbst.
function tabelleFuerVeranstaltung(veranstaltungId: string): TabellenEintrag[] {
	const v = getVeranstaltungById(veranstaltungId);
	if (!v) return [];
	const chart = getMatchPlayChart(v.id);
	if (!chart) return [];
	return chart.teams.map((team, i) => ({
		mannschaft_id: i + 1,
		mannschaft_name: team.name,
		matchpunkte: team.matchPoints,
		// Admin-Eingabe (#7) kennt nur eine einzelne Satzpunkte-Zahl (bereits netto) — kein
		// separates Verlust-Matchpunkte-Feld wie im liga-Referenzprojekt.
		matchpunkte_neg: 0,
		satzpunkte_netto: team.setPoints
	}));
}

export function getContentForJwt(jwt: string): DisplayContent | undefined {
	const record = displays.get(jwt);
	if (!record) return undefined;

	const bildschirm = findBildschirmByPin(record.pin);
	if (!bildschirm || !bildschirm.aktiv) {
		return { paired: false, mode: 'ergebnisse', scheibe_a: null, scheibe_b: null };
	}

	if (bildschirm.mode === 'tabelle') {
		return {
			paired: true,
			mode: 'tabelle',
			scheibe_a: null,
			scheibe_b: null,
			tabelle: tabelleFuerVeranstaltung(bildschirm.veranstaltung_id)
		};
	}

	return {
		paired: true,
		mode: 'ergebnisse',
		scheibe_a: buildSeiteForScheibe(bildschirm.scheibe_a),
		scheibe_b: buildSeiteForScheibe(bildschirm.scheibe_b)
	};
}
