import { authHandlers } from './auth';
import { displayHandlers } from './display';
import { binocularHandlers } from './binocular';
import { veranstaltungHandlers } from './veranstaltung';
import { deviceHandlers } from './devices';

/**
 * Eine Handler-Datei pro Feature-Modul, gespiegelt zu src/lib/api/*.ts.
 * Neues Feature-Modul (z.B. scoreboard.ts) -> passende scoreboard.ts hier anlegen
 * und hier registrieren.
 */
export const handlers = [
	...authHandlers,
	...displayHandlers,
	...binocularHandlers,
	...veranstaltungHandlers,
	...deviceHandlers
];
