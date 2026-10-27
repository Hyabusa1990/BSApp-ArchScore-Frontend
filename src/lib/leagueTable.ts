import type { LeagueTablePosition } from '$lib/api/display';

export type LeagueTableRow = LeagueTablePosition & { position: number };

/**
 * Initiale Tabelle: Fawkes vergibt allen Mannschaften denselben Rang (aktuell 1, früher 0). Der
 * gemeinsame Rang sagt dann nichts über die Reihenfolge, also gilt die API-Reihenfolge.
 */
function isInitialTable(entries: LeagueTablePosition[]): boolean {
	return entries.length > 1 && entries.every((e) => e.rank === entries[0].rank);
}

/**
 * Initiale Tabelle: API-Reihenfolge, Plätze aufsteigend, keine Trendanzeige. Sonst nach Rang
 * sortiert und der Backend-Rang angezeigt; Mannschaften mit gleichem Rang teilen sich den Platz.
 * Ein Rang < 1 ist unbrauchbar und fällt auf die aufsteigende Position zurück.
 */
export function orderLeagueTable(entries: LeagueTablePosition[]): {
	rows: LeagueTableRow[];
	ranked: boolean;
} {
	const initial = isInitialTable(entries);
	const ordered = initial ? [...entries] : [...entries].sort((a, b) => a.rank - b.rank);
	return {
		rows: ordered.map((e, i) => ({
			...e,
			position: !initial && e.rank >= 1 ? e.rank : i + 1
		})),
		ranked: !initial
	};
}
