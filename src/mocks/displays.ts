import type { DisplayContent, DisplaySeite, TabellenEintrag } from '$lib/api/display';
import {
	findAktivesMatchFuerScheibe,
	findBildschirmByPin,
	getMatchPlayChart,
	getVeranstaltungById,
	mannschaftUndGegner
} from './veranstaltungen';
import { berechneMatchStand, peekScoringState, ringSumme } from './shared-state';
import { encodeShots } from './binoculars';

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

function leereSeite(targetNo: number | null): DisplaySeite {
	return {
		targetNo,
		teamName: null,
		shots: null,
		setScores: null,
		currentSetScore: null,
		setPoints: null
	};
}

function buildSeiteForScheibe(scheibennummer: number | null): DisplaySeite {
	if (scheibennummer === null) return leereSeite(null);

	const found = findAktivesMatchFuerScheibe(scheibennummer);
	if (!found) return leereSeite(scheibennummer);

	const { mannschaft } = mannschaftUndGegner(found.begegnung, found.seite);
	const scoringOwn = peekScoringState(scheibennummer);

	// Match aktiv, aber der Spotter hat diese Scheibe noch nie geöffnet — Scoring-Zustand
	// existiert dann noch gar nicht (peekScoringState legt ihn bewusst nicht an, siehe
	// shared-state.ts). shots/setScores bleiben leer -> deriveMonitorStatus liefert
	// VOR_DEM_MATCH. shooters ist reiner Mock-Platzhalter (das Admin-Modell kennt keine echte
	// Schützen-Aufstellung, siehe binoculars.ts) — nur damit der Chip-Zweig testbar ist.
	if (!scoringOwn) {
		return {
			targetNo: scheibennummer,
			teamName: mannschaft,
			shots: null,
			setScores: null,
			currentSetScore: null,
			setPoints: null,
			shooters: ['Schütze 1', 'Schütze 2', 'Schütze 3']
		};
	}

	const gegnerScheibe = found.seite === 'a' ? found.begegnung.scheibe_b : found.begegnung.scheibe_a;
	const stand = berechneMatchStand(
		found.seite === 'a' ? scheibennummer : gegnerScheibe,
		found.seite === 'a' ? gegnerScheibe : scheibennummer
	);
	const eigeneSatzpunkte = found.seite === 'a' ? stand.satzpunkteA : stand.satzpunkteB;

	const lfdNr = scoringOwn.aktueller_satz;
	const passenAktuellerSatz = scoringOwn.vorlaeufige_passen.filter((p) => p.lfd_nr === lfdNr);
	const shotsAktuellerSatz = encodeShots(passenAktuellerSatz);

	// Eigene Ringsummen aller vom eigenen Spotter schon bestätigten Sätze — unabhängig davon,
	// ob die Gegenseite auch schon fertig ist (Fortschritt bleibt pro Spotter unabhängig,
	// siehe FACHLICHKEIT.md). Kein eigener "Match fertig"-Zustand mehr (#16): die letzten
	// setScores bleiben nach Matchende einfach stehen.
	const setScores = Array.from({ length: lfdNr - 1 }, (_, i) =>
		ringSumme(scoringOwn.vorlaeufige_passen, i + 1)
	);

	return {
		targetNo: scheibennummer,
		teamName: mannschaft,
		shots: shotsAktuellerSatz || null,
		setScores: setScores.length > 0 ? setScores : null,
		currentSetScore: shotsAktuellerSatz ? ringSumme(scoringOwn.vorlaeufige_passen, lfdNr) : null,
		setPoints: eigeneSatzpunkte
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
