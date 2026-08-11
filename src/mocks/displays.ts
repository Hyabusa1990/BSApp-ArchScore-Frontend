import type { DisplayContent, DisplaySeite, TabellenEintrag } from '$lib/api/display';

/**
 * In-memory Fake-Backend-Zustand für Displays — eigener Store, bewusst nicht geteilt mit
 * `db.ts` (das bleibt auth-spezifisch). Siehe FACHLICHKEIT.md/Issue #10: die Admin-Verwaltung
 * wird diesen Store später ersetzen/speisen; bis dahin schreitet jedes Display pro Content-Poll
 * einen festen Demo-Zyklus weiter, damit die Trefferanzeige+Tabellenansicht (#2/#3) ganz ohne
 * Admin-UI durchspielbar sind.
 */

interface DisplayRecord {
	pin: string;
	pollCount: number;
}

const displays = new Map<string, DisplayRecord>();

const UNPAIRED_POLLS = 2;

function generatePin(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne verwechselbare Zeichen (0/O, 1/I)
	return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function registerDisplay(): { jwt: string; pin: string } {
	const jwt = `mock-display.${crypto.randomUUID()}`;
	const pin = generatePin();
	displays.set(jwt, { pin, pollCount: 0 });
	return { jwt, pin };
}

export function getContentForJwt(jwt: string): DisplayContent | undefined {
	const record = displays.get(jwt);
	if (!record) return undefined;

	const content = buildContent(record.pollCount);
	record.pollCount += 1;
	return content;
}

// ── Szenario-Bausteine ──────────────────────────────────────────────────────
// Einzeln exportiert, damit #2/#3 (oder spätere manuelle Tests) gezielt einen Zustand
// referenzieren können, unabhängig vom Auto-Zyklus unten.

const TEAM_A = 'BSC Ostermorgen';
const TEAM_B = 'SV Altheim-Waldhausen';
const SCHUETZEN_A = ['Mayer, Hans', 'Grau, Ina', 'Ars, Peter'];
const SCHUETZEN_B = ['Adenauer, A.', 'Berter, A.', 'Hauser, P.'];

export function seiteWartet(scheibennummer: number): DisplaySeite {
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

export function seiteSchuetzenGemeldet(
	scheibennummer: number,
	mannschaftName: string,
	schuetzen: string[]
): DisplaySeite {
	return {
		scheibennummer,
		mannschaft_name: mannschaftName,
		monitor_status: 'SCHUETZEN_GEMELDET',
		schuetzen,
		aktueller_satz: 1,
		pfeile: [],
		satz_ergebnisse: [],
		matchpunkte: null,
		satzpunkte: null
	};
}

export function seiteSatzLaeuft(
	scheibennummer: number,
	mannschaftName: string,
	schuetzen: string[],
	satz: number,
	pfeilwerte: number[],
	vorherigeSaetze: DisplaySeite['satz_ergebnisse']
): DisplaySeite {
	const pfeile = pfeilwerte.map((ringzahl, i) => ({
		position: Math.floor(i / 2) + 1,
		name: schuetzen[Math.floor(i / 2)] ?? `Position ${Math.floor(i / 2) + 1}`,
		ringzahl_pfeil1: i % 2 === 0 ? ringzahl : null,
		ringzahl_pfeil2: i % 2 === 1 ? ringzahl : null
	}));
	// Pfeile paarweise zusammenführen (position teilt sich pfeil1/pfeil2), wie im Referenzprojekt.
	const merged: DisplaySeite['pfeile'] = [];
	for (const p of pfeile) {
		const existing = merged.find((m) => m.position === p.position);
		if (existing) {
			if (p.ringzahl_pfeil1 !== null) existing.ringzahl_pfeil1 = p.ringzahl_pfeil1;
			if (p.ringzahl_pfeil2 !== null) existing.ringzahl_pfeil2 = p.ringzahl_pfeil2;
		} else {
			merged.push({ ...p });
		}
	}
	return {
		scheibennummer,
		mannschaft_name: mannschaftName,
		monitor_status: 'SATZ_LAEUFT',
		schuetzen,
		aktueller_satz: satz,
		pfeile: merged,
		satz_ergebnisse: vorherigeSaetze,
		matchpunkte: null,
		// Satzpunkte sind laut Referenzprojekt (MonitorTeamBlock.svelte) erst ab SATZ_FERTIG
		// relevant/sichtbar — während SATZ_LAEUFT bewusst null.
		satzpunkte: null
	};
}

export function seiteSatzFertig(
	scheibennummer: number,
	mannschaftName: string,
	schuetzen: string[],
	satzErgebnisse: DisplaySeite['satz_ergebnisse'],
	satzpunkte: number
): DisplaySeite {
	return {
		scheibennummer,
		mannschaft_name: mannschaftName,
		monitor_status: 'SATZ_FERTIG',
		schuetzen,
		aktueller_satz: satzErgebnisse.length,
		pfeile: [],
		satz_ergebnisse: satzErgebnisse,
		matchpunkte: null,
		satzpunkte
	};
}

export function seiteMatchFertig(
	scheibennummer: number,
	mannschaftName: string,
	schuetzen: string[],
	satzErgebnisse: DisplaySeite['satz_ergebnisse'],
	matchpunkte: number
): DisplaySeite {
	return {
		scheibennummer,
		mannschaft_name: mannschaftName,
		monitor_status: 'MATCH_FERTIG',
		schuetzen,
		aktueller_satz: 5,
		pfeile: [],
		satz_ergebnisse: satzErgebnisse,
		matchpunkte,
		satzpunkte: null
	};
}

export const tabellenFixture: TabellenEintrag[] = [
	{
		mannschaft_id: 1,
		mannschaft_name: 'BSC Abendau',
		matchpunkte: 14,
		matchpunkte_neg: 8,
		satzpunkte_netto: 15
	},
	{
		mannschaft_id: 2,
		mannschaft_name: 'SV Scharfhaus',
		matchpunkte: 11,
		matchpunkte_neg: 11,
		satzpunkte_netto: 7
	},
	{
		mannschaft_id: 3,
		mannschaft_name: 'SGes Schützenschaft',
		matchpunkte: 11,
		matchpunkte_neg: 11,
		satzpunkte_netto: -5
	},
	{
		mannschaft_id: 4,
		mannschaft_name: 'BS Hunshausen',
		matchpunkte: 6,
		matchpunkte_neg: 16,
		satzpunkte_netto: 12
	},
	{
		mannschaft_id: 5,
		mannschaft_name: 'SV Vogelwiese',
		matchpunkte: 8,
		matchpunkte_neg: 14,
		satzpunkte_netto: 8
	},
	{
		mannschaft_id: 6,
		mannschaft_name: 'BS Weiß-Blau München',
		matchpunkte: 2,
		matchpunkte_neg: 20,
		satzpunkte_netto: -10
	},
	{
		mannschaft_id: 7,
		mannschaft_name: 'SGi Wuppenhausen',
		matchpunkte: 2,
		matchpunkte_neg: 20,
		satzpunkte_netto: -22
	},
	{
		mannschaft_id: 8,
		mannschaft_name: 'BSC Rot-Rot Beerendorf',
		matchpunkte: 0,
		matchpunkte_neg: 22,
		satzpunkte_netto: -15
	}
];

// ── Auto-Zyklus ──────────────────────────────────────────────────────────────
// Ein "Schritt" pro Content-Poll. Läuft nach dem letzten Schritt von vorn los.

const satz1: DisplaySeite['satz_ergebnisse'] = [
	{
		lfd_nr: 1,
		eigene_ringe: 55,
		gegner_ringe: 52,
		eigene_strafpunkte: 0,
		gegner_strafpunkte: 0,
		beide_eingegeben: true
	}
];
const satz2: DisplaySeite['satz_ergebnisse'] = [
	...satz1,
	{
		lfd_nr: 2,
		eigene_ringe: 53,
		gegner_ringe: 54,
		eigene_strafpunkte: 0,
		gegner_strafpunkte: 0,
		beide_eingegeben: true
	}
];
const satz3: DisplaySeite['satz_ergebnisse'] = [
	...satz2,
	{
		lfd_nr: 3,
		eigene_ringe: 56,
		gegner_ringe: 50,
		eigene_strafpunkte: 0,
		gegner_strafpunkte: 0,
		beide_eingegeben: true
	}
];

type Step = () => {
	mode: DisplayContent['mode'];
	scheibe_a: DisplaySeite | null;
	scheibe_b: DisplaySeite | null;
};

const steps: Step[] = [
	() => ({ mode: 'ergebnisse', scheibe_a: seiteWartet(1), scheibe_b: seiteWartet(2) }),
	() => ({
		mode: 'ergebnisse',
		scheibe_a: seiteSchuetzenGemeldet(1, TEAM_A, SCHUETZEN_A),
		scheibe_b: seiteSchuetzenGemeldet(2, TEAM_B, SCHUETZEN_B)
	}),
	() => ({
		mode: 'ergebnisse',
		scheibe_a: seiteSatzLaeuft(1, TEAM_A, SCHUETZEN_A, 1, [10, 9, 10], []),
		scheibe_b: seiteSatzLaeuft(2, TEAM_B, SCHUETZEN_B, 1, [8, 9], [])
	}),
	() => ({
		mode: 'ergebnisse',
		scheibe_a: seiteSatzFertig(1, TEAM_A, SCHUETZEN_A, satz1, 2),
		scheibe_b: seiteSatzFertig(2, TEAM_B, SCHUETZEN_B, satz1, 0)
	}),
	() => ({
		mode: 'ergebnisse',
		scheibe_a: seiteSatzLaeuft(1, TEAM_A, SCHUETZEN_A, 2, [9, 8, 10], satz1),
		scheibe_b: seiteSatzLaeuft(2, TEAM_B, SCHUETZEN_B, 2, [10, 9], satz1)
	}),
	() => ({
		mode: 'ergebnisse',
		scheibe_a: seiteSatzFertig(1, TEAM_A, SCHUETZEN_A, satz2, 2),
		scheibe_b: seiteSatzFertig(2, TEAM_B, SCHUETZEN_B, satz2, 2)
	}),
	() => ({
		mode: 'ergebnisse',
		scheibe_a: seiteSatzLaeuft(1, TEAM_A, SCHUETZEN_A, 3, [10, 10, 9], satz2),
		scheibe_b: seiteSatzLaeuft(2, TEAM_B, SCHUETZEN_B, 3, [8, 7], satz2)
	}),
	() => ({
		mode: 'ergebnisse',
		scheibe_a: seiteMatchFertig(1, TEAM_A, SCHUETZEN_A, satz3, 6),
		scheibe_b: seiteMatchFertig(2, TEAM_B, SCHUETZEN_B, satz3, 4)
	}),
	() => ({
		mode: 'ergebnisse',
		scheibe_a: seiteMatchFertig(1, TEAM_A, SCHUETZEN_A, satz3, 6),
		scheibe_b: seiteMatchFertig(2, TEAM_B, SCHUETZEN_B, satz3, 4)
	}),
	() => ({ mode: 'tabelle', scheibe_a: null, scheibe_b: null }),
	() => ({ mode: 'tabelle', scheibe_a: null, scheibe_b: null }),
	() => ({ mode: 'tabelle', scheibe_a: null, scheibe_b: null })
];

function buildContent(pollCount: number): DisplayContent {
	if (pollCount < UNPAIRED_POLLS) {
		return { paired: false, mode: 'ergebnisse', scheibe_a: null, scheibe_b: null };
	}
	const step = steps[(pollCount - UNPAIRED_POLLS) % steps.length]();
	return {
		paired: true,
		...step,
		tabelle: step.mode === 'tabelle' ? tabellenFixture : undefined
	};
}
