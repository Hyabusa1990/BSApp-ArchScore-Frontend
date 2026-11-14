/** Satzpunkte, ab denen ein Match gewonnen ist (FACHLICHKEIT.md). */
export const SIEG_SATZPUNKTE = 6;

/**
 * Match ist beendet, wenn eine Seite mindestens 6 Satzpunkte hat oder nach 5 Sätzen 5:5 steht
 * (Unentschieden, kein Stechen). Fehlt ein Wert, gilt das Match als nicht beendet.
 */
export function isMatchBeendet(
	a: number | null | undefined,
	b: number | null | undefined
): boolean {
	if (a == null || b == null) return false;
	return Math.max(a, b) >= SIEG_SATZPUNKTE || (a === 5 && b === 5);
}
