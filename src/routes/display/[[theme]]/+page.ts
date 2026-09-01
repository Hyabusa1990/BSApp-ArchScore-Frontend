import type { PageLoad } from './$types';

export type DisplayTheme = 'light' | 'dark';

/**
 * `/display` (kein Segment) und `/display/dark` sind gleichwertig — `dark` ist der Standard,
 * wenn nichts angegeben wird (Wunsch Gero, 2026-08-18). Alles außer `light` fällt bewusst auf
 * `dark` zurück statt 404 (korrigiert 2026-08-18) — ein an der Sporthalle fest verkabelter
 * Bildschirm soll bei einem Tippfehler in der URL trotzdem etwas Sinnvolles zeigen, nicht eine
 * Fehlerseite.
 */
export const load: PageLoad = ({ params }) => {
	const theme: DisplayTheme = params.theme === 'light' ? 'light' : 'dark';
	return { theme };
};
