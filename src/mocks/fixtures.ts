import type { User } from '$lib/api/auth';

/**
 * Mock-Fixtures: benannte Szenario-User für die Fake-API.
 * Shape folgt `User` aus `src/lib/api/auth.ts`. `id`/`email` entsprechen dem Fawkes-Kontrakt
 * (`GET /Auth/me` liefert nur `{id, email}`); `role` ist dort NICHT Teil der Response —
 * bleibt hier trotzdem im Fixture/DB-Modell, weil `src/mocks/veranstaltungen.ts` intern
 * noch darüber Admin-weite vs. Owner-scoped Sicht entscheidet (separate Klärung zu
 * Ownership, s. CLAUDE.md "Permissions/roles"). `user` (verwaltet eigene Veranstaltungen)
 * und `admin` (verwaltet Benutzer + alle Veranstaltungen). Kein Django-artiges
 * is_staff/permissions/groups-Modell.
 *
 * Wichtig: das ist eine ANDERE Achse als die Wettkampf-Rollen aus FACHLICHKEIT.md
 * (Schütze, Spotter, Kampfrichter, Zuschauer) — die laufen über eigene, passwortlose
 * Token-URLs (Display-JWT, Tablet-QR-Token), nicht über dieses Account-`role`-Feld.
 */

export const users = {
	member: {
		id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
		email: 'max@example.com',
		role: 'user'
	},
	admin: {
		id: '110ec58a-a0f2-4ac4-8393-c866d813b8d1',
		email: 'admin@example.com',
		role: 'admin'
	}
} satisfies Record<string, User>;
