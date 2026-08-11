/**
 * Kleiner Persistenz-Helfer für Mock-Zustand, der über mehrere Browser-Tabs hinweg konsistent
 * sein muss (Admin-Verwaltung, Display, Spotter-Tablet laufen in der Realität auf
 * verschiedenen Geräten — im Dev-Setup simuliert durch verschiedene Tabs).
 *
 * Wichtig: MSW-Handler laufen pro Tab im JS-Kontext genau DIESES Tabs — reine
 * Modul-Variablen (`const foo: Foo[] = [...]`) sind deshalb NICHT tab-übergreifend
 * konsistent. `localStorage` ist es (gleicher Origin), deshalb hier die Quelle der Wahrheit.
 * Jeder Store liest bei jedem Zugriff frisch aus `localStorage` und schreibt nach jeder
 * Mutation zurück, statt einmalig beim Modul-Load zu initialisieren.
 */

const PREFIX = 'archscore-mock:';
const VERSION = 1;

interface Envelope<T> {
	version: number;
	data: T;
}

export function loadState<T>(key: string, initial: () => T): T {
	if (typeof localStorage === 'undefined') return initial();
	try {
		const raw = localStorage.getItem(PREFIX + key);
		if (!raw) return initial();
		const parsed = JSON.parse(raw) as Envelope<T>;
		if (parsed.version !== VERSION) return initial();
		return parsed.data;
	} catch {
		return initial();
	}
}

export function saveState<T>(key: string, data: T): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(PREFIX + key, JSON.stringify({ version: VERSION, data }));
}

export function mapToEntries<K, V>(map: Map<K, V>): [K, V][] {
	return [...map.entries()];
}
