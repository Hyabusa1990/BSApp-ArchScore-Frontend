import type { User } from '$lib/api/auth';

/**
 * Mock-Fixtures: benannte Szenario-User für die Fake-API.
 * Shape folgt 1:1 `User` aus `src/lib/api/auth.ts`, die wiederum der openapi.yaml-Spec
 * folgt (id: uuid string, username, email, role: archer|judge|admin). Rechte werden
 * rein über `role` entschieden (siehe PermGuard.svelte, +layout.svelte showAdminLink) —
 * kein Django-artiges is_staff/permissions/groups-Modell.
 */

export const users = {
	member: {
		id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
		username: 'max.mustermann',
		email: 'max@example.com',
		role: 'archer'
	},
	judge: {
		id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
		username: 'erika.judge',
		email: 'erika@example.com',
		role: 'judge'
	},
	admin: {
		id: '110ec58a-a0f2-4ac4-8393-c866d813b8d1',
		username: 'admin',
		email: 'admin@example.com',
		role: 'admin'
	}
} satisfies Record<string, User>;
