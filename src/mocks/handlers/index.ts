import { authHandlers } from './auth';
import { configHandlers } from './config';
import { displayHandlers } from './display';

/**
 * Eine Handler-Datei pro Feature-Modul, gespiegelt zu src/lib/api/*.ts.
 * Neues Feature-Modul (z.B. scoreboard.ts) -> passende scoreboard.ts hier anlegen
 * und hier registrieren.
 */
export const handlers = [...authHandlers, ...configHandlers, ...displayHandlers];
