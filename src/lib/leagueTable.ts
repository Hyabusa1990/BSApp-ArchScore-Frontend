import type { LeagueTablePosition } from '$lib/api/display';

export type LeagueTableRow = LeagueTablePosition & { position: number };

/**
 * Fawkes liefert vor der ersten Berechnung `rank: 0` für alle Mannschaften (Display liest nur die
 * Live-Spalten, nicht `InitialRank`). Sind nicht alle Ränge ≥ 1, bleibt die Reihenfolge der
 * API-Antwort erhalten. Angezeigt wird der Backend-Rang (auch bei Gleichstand, mehrere Teams
 * teilen sich dann denselben Platz); bei `rank === 0` die aufsteigende Position.
 */
export function hasValidRanks(entries: LeagueTablePosition[]): boolean {
	return entries.every((e) => e.rank >= 1);
}

export function orderLeagueTable(entries: LeagueTablePosition[]): {
	rows: LeagueTableRow[];
	ranked: boolean;
} {
	const ranked = hasValidRanks(entries);
	const ordered = ranked ? [...entries].sort((a, b) => a.rank - b.rank) : [...entries];
	return {
		rows: ordered.map((e, i) => ({ ...e, position: e.rank > 0 ? e.rank : i + 1 })),
		ranked
	};
}
