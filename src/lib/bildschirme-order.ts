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

/**
 * Wendet eine eigene Reihenfolge (Geräte-IDs) an. Ohne `order` gilt die Feldreihenfolge.
 * Unbekannte (entfernte) IDs werden ignoriert, neue Geräte kommen in Feldreihenfolge ans Ende.
 */
export function applyCustomOrder(devices: Device[], order: number[] | null): Device[] {
	const byField = sortDevicesByField(devices);
	if (!order) return byField;
	const byId = new Map(devices.map((d) => [d.id, d]));
	const seen = new Set<number>();
	const result: Device[] = [];
	for (const id of order) {
		const d = byId.get(id);
		if (d && !seen.has(id)) {
			seen.add(id);
			result.push(d);
		}
	}
	for (const d of byField) if (!seen.has(d.id)) result.push(d);
	return result;
}

/**
 * Verschiebt `fromId` an die Position von `toId` (andere rücken nach). Bei gleicher oder
 * unbekannter ID bleibt die Reihenfolge unverändert. Gibt ein neues Array zurück.
 */
export function moveDevice(ids: number[], fromId: number, toId: number): number[] {
	const from = ids.indexOf(fromId);
	const to = ids.indexOf(toId);
	if (from < 0 || to < 0 || from === to) return [...ids];
	const next = [...ids];
	next.splice(from, 1);
	next.splice(to, 0, fromId);
	return next;
}
