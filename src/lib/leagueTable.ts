import type { LeagueTablePosition } from '$lib/api/display';

/**
 * Fawkes liefert vor der ersten Berechnung `rank: 0` für alle Mannschaften (Display liest nur die
 * Live-Spalten, nicht `InitialRank`). Sind die Ränge nicht eindeutig oder < 1, ist der Rang
 * unbrauchbar: dann bleibt die Reihenfolge der API-Antwort erhalten und es wird kein Rang gezeigt.
 */
export function hasValidRanks(entries: LeagueTablePosition[]): boolean {
	const ranks = entries.map((e) => e.rank);
	return ranks.every((r) => r >= 1) && new Set(ranks).size === ranks.length;
}

export function orderLeagueTable(entries: LeagueTablePosition[]): {
	rows: LeagueTablePosition[];
	ranked: boolean;
} {
	const ranked = hasValidRanks(entries);
	return {
		rows: ranked ? [...entries].sort((a, b) => a.rank - b.rank) : [...entries],
		ranked
	};
}
