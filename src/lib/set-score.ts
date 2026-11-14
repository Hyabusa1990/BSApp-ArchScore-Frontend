import { decodeShot, encodeShot } from '$lib/api/binocular';

/** Pfeile pro Satz (3 Schützen × 2 Pfeile). */
export const SET_ARROWS = 6;

/** Ringsumme eines `shots`-Strings ("+" = 10, "0" = Miss). */
export function setScoreOf(shots: string): number {
	let sum = 0;
	for (const char of shots) sum += decodeShot(char);
	return sum;
}

/**
 * Verteilt eine Änderung der Satzsumme um ±1 auf die Einzelpfeile eines vollständigen Satzes
 * (Fawkes kennt nur den `shots`-String, keine Summe):
 * - `+1` erhöht den niedrigsten Pfeil unter 10, bei Gleichstand den linken,
 * - `-1` senkt den höchsten Pfeil über 0, bei Gleichstand den linken.
 *
 * Gibt `null` zurück, wenn kein Pfeil änderbar ist (Summe 60 bzw. 0) oder der String keine
 * genau 6 Pfeile enthält — die Verteilung ist nur für vollständige Sätze definiert.
 */
export function adjustSetScore(shots: string, delta: 1 | -1): string | null {
	if (shots.length !== SET_ARROWS) return null;
	const values = [...shots].map(decodeShot);

	let index = -1;
	for (let i = 0; i < values.length; i++) {
		if (delta === 1) {
			if (values[i] < 10 && (index === -1 || values[i] < values[index])) index = i;
		} else if (values[i] > 0 && (index === -1 || values[i] > values[index])) {
			index = i;
		}
	}
	if (index === -1) return null;

	values[index] += delta;
	return values.map(encodeShot).join('');
}
