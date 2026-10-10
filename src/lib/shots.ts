/**
 * Fawkes füllt den `shots`-String eines Satzes beim Lesen mit Leerzeichen auf die Satzlänge
 * auf (`Scoresheet.AllShots`, `PadRight`): ein einzelner Pfeil `+` kommt als `"+     "` zurück,
 * ein bestätigter/leerer Satz als `"      "`. Leerzeichen sind also "nicht geschossen", nie ein
 * Pfeil — ohne Bereinigung hängt der Spotter den nächsten Pfeil hinter die Füllzeichen (Fawkes
 * schneidet ihn ab) und `decodeShot(' ')` ergibt fälschlich 0 = "M".
 */
export function normalizeShots(shots: string | null | undefined): string {
	return (shots ?? '').trimEnd();
}

/** Wie `normalizeShots`, lässt `null` aber `null` (Feld ist in der API nullable). */
export function normalizeShotsOrNull(shots: string | null): string | null {
	return shots === null ? null : normalizeShots(shots);
}
