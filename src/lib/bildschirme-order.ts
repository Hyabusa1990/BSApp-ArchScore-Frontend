import type { Device } from '$lib/api/bildschirme';

/**
 * Sortiert Bildschirme in der Reihenfolge des Wettkampffelds (Begegnung 1 = Scheiben 1/2,
 * 2 = 3/4, ...): zuerst Match-Displays mit `matchNo`, dann Match ohne `matchNo`, dann alle
 * übrigen (Tabelle/aus). Gleichstand jeweils nach `id`. Gibt ein neues Array zurück.
 */
export function sortDevicesByField(devices: Device[]): Device[] {
	const group = (d: Device) => (d.displayType === 'Match' ? (d.matchNo === null ? 1 : 0) : 2);
	return [...devices].sort((a, b) => {
		const g = group(a) - group(b);
		if (g !== 0) return g;
		if (group(a) === 0) {
			const m = (a.matchNo as number) - (b.matchNo as number);
			if (m !== 0) return m;
		}
		return a.id - b.id;
	});
}
