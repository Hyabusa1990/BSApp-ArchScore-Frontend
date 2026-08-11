import type { User } from '$lib/api/auth';

/**
 * Mock-Fixtures: benannte Szenario-User für die Fake-API.
 * Shape folgt 1:1 `User` aus `src/lib/api/auth.ts`, die wiederum der openapi.yaml-Spec
 * folgt (id: uuid string, username, email). Rechte werden rein über `role` entschieden
 * (siehe PermGuard.svelte, +layout.svelte showAdminLink) — genau zwei Werte:
 * `user` (verwaltet eigene Veranstaltungen) und `admin` (verwaltet Benutzer + alle
 * Veranstaltungen). Kein Django-artiges is_staff/permissions/groups-Modell.
 *
 * Wichtig: das ist eine ANDERE Achse als die Wettkampf-Rollen aus FACHLICHKEIT.md
 * (Schütze, Spotter, Kampfrichter, Zuschauer) — die laufen über eigene, passwortlose
 * Token-URLs (Display-JWT, Tablet-QR-Token), nicht über dieses Account-`role`-Feld.
 */

export const users = {
	member: {
		id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
		username: 'max.mustermann',
		email: 'max@example.com',
		role: 'user'
	},
	admin: {
		id: '110ec58a-a0f2-4ac4-8393-c866d813b8d1',
		username: 'admin',
		email: 'admin@example.com',
		role: 'admin'
	}
} satisfies Record<string, User>;
