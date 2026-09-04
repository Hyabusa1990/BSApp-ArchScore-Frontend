import type { PageLoad } from './$types';

export type ThemeHint = 'light' | 'dark';

/**
 * `/display` (kein Segment) und `/display/dark` sind gleichwertig — `dark` ist der Standard,
 * wenn nichts angegeben wird (Wunsch Gero, 2026-08-18). Alles außer `light` fällt bewusst auf
 * `dark` zurück statt 404 (korrigiert 2026-08-18) — ein an der Sporthalle fest verkabelter
 * Bildschirm soll bei einem Tippfehler in der URL trotzdem etwas Sinnvolles zeigen, nicht eine
 * Fehlerseite.
 *
 * Seit Spec-Sync 2026-09-04 liefert `GET /Display/data` ein eigenes `displayTheme`-Feld
 * (Admin legt es pro Gerät fest, siehe `$lib/api/bildschirme.ts`) — das macht dieses Segment
 * nicht mehr zur Wahrheitsquelle, sondern nur noch zum Rate-Wert für den allerersten
 * Ladezustand (Hintergrundfarbe während `LOADING`, bevor die erste Antwort da ist), siehe
 * `+page.svelte`.
 */
export const load: PageLoad = ({ params }) => {
	const theme: ThemeHint = params.theme === 'light' ? 'light' : 'dark';
	return { theme };
};
