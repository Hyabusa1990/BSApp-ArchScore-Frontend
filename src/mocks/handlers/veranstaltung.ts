import { http, HttpResponse } from 'msw';
import { API_URL } from '$lib/config';
import type { User } from '$lib/api/auth';
import type { MatchPlayChartTeam } from '$lib/api/veranstaltung';
import { userFromAccessToken } from '../db';
import {
	addFixtureUser,
	bildschirmeFor,
	connectLiga,
	createBildschirm,
	createMatchPlayChart,
	createVeranstaltung,
	findVeranstaltung,
	generateTabletToken,
	getCurrentRoundNo,
	getMatchPlayChart,
	isFixtureOwner,
	matchesFor,
	removeFixtureUser,
	removeVeranstaltung,
	setCurrentRoundNo,
	updateBildschirm,
	usersFor,
	visibleVeranstaltungen
} from '../veranstaltungen';

/**
 * Verwaltungsoberfläche: einziger Bereich mit echtem Account-Login (bestehender
 * access_token, siehe auth.ts/db.ts) statt der zweckgebundenen Tokens von
 * Display/Binocular. Sichtbarkeits-Filterung passiert hier, nicht auf Routen-Ebene
 * (siehe Issue #6 — kein role==="admin"-Gate, jeder eingeloggte Account darf rein,
 * sieht aber nur, was für ihn sichtbar ist — seit #14 über echte Fixture-Mitgliedschaft).
 *
 * `/Fixture`, `/Fixture/{id}`, `/Fixture/{id}/users...`, `/MatchPlayChart/{fixtureId}` folgen
 * dem echten Fawkes-Kontrakt (Issue #14). `/veranstaltungen/{id}/...` bleiben eigene, nicht in
 * der Spec vorhandene Sub-Ressourcen (Matches/Bildschirme/Tablet-Pairing/Liga-Verbindung) —
 * ihr `:id` ist seit #14 einfach die stringifizierte Fixture-ID.
 */

function requireUser(request: Request): User | undefined {
	return userFromAccessToken(request.headers.get('Authorization'));
}

function unauthorized() {
	return HttpResponse.json(
		{ code: 'UNAUTHORIZED', message: 'Token ungültig oder abgelaufen' },
		{ status: 401 }
	);
}

function notFound() {
	return HttpResponse.json({ detail: 'Veranstaltung nicht gefunden' }, { status: 404 });
}

function forbidden() {
	return HttpResponse.json(
		{ code: 'FORBIDDEN', message: 'Nur Owner dürfen Mitglieder verwalten' },
		{ status: 403 }
	);
}

export const veranstaltungHandlers = [
	http.get(`${API_URL}/Fixture`, ({ request }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		return HttpResponse.json(visibleVeranstaltungen(user));
	}),

	http.post(`${API_URL}/Fixture`, async ({ request }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const body = (await request.json()) as {
			date?: string;
			location?: string;
			leagueName?: string;
			fixtureName?: string;
		};
		const errors: { field: string; message: string }[] = [];
		if (!body.date) errors.push({ field: 'date', message: 'Pflichtfeld darf nicht leer sein' });
		if (!body.location)
			errors.push({ field: 'location', message: 'Pflichtfeld darf nicht leer sein' });
		if (!body.leagueName)
			errors.push({ field: 'leagueName', message: 'Pflichtfeld darf nicht leer sein' });
		if (!body.fixtureName)
			errors.push({ field: 'fixtureName', message: 'Pflichtfeld darf nicht leer sein' });
		if (errors.length) return HttpResponse.json({ errors }, { status: 422 });

		return HttpResponse.json(
			createVeranstaltung(user, {
				date: body.date!,
				location: body.location!,
				leagueName: body.leagueName!,
				fixtureName: body.fixtureName!
			}),
			{ status: 201 }
		);
	}),

	http.get(`${API_URL}/Fixture/:id`, ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const v = findVeranstaltung(user, Number(params.id));
		if (!v) return notFound();
		return HttpResponse.json(v);
	}),

	http.delete(`${API_URL}/Fixture/:id`, ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		if (!removeVeranstaltung(user, Number(params.id))) return notFound();
		return new HttpResponse(null, { status: 204 });
	}),

	http.get(`${API_URL}/MatchPlayChart/:fixtureId`, ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const v = findVeranstaltung(user, Number(params.fixtureId));
		if (!v) return notFound();
		const chart = getMatchPlayChart(v.id);
		if (!chart)
			return HttpResponse.json({ detail: 'Noch keine Tabelle angelegt' }, { status: 404 });
		return HttpResponse.json(chart);
	}),

	// Kein hardOverride im Request (#14) -> 409, falls für diese Fixture schon eine Tabelle
	// existiert (Standardverhalten laut Spec: Fehler statt Überschreiben).
	http.post(`${API_URL}/MatchPlayChart/:fixtureId`, async ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const v = findVeranstaltung(user, Number(params.fixtureId));
		if (!v) return notFound();
		const body = (await request.json()) as { teams?: MatchPlayChartTeam[] };
		if (!Array.isArray(body.teams) || body.teams.length === 0) {
			return HttpResponse.json({ detail: 'teams fehlt oder ist leer' }, { status: 422 });
		}
		const chart = createMatchPlayChart(v, body.teams);
		if (!chart) {
			return HttpResponse.json(
				{ detail: 'Für diese Fixture existiert bereits eine Tabelle' },
				{ status: 409 }
			);
		}
		return HttpResponse.json(chart);
	}),

	http.post(`${API_URL}/veranstaltungen/:id/liga`, async ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const v = findVeranstaltung(user, Number(params.id));
		if (!v) return notFound();
		const body = (await request.json()) as NonNullable<typeof v.liga>;
		return HttpResponse.json(connectLiga(v, body));
	}),

	http.get(`${API_URL}/veranstaltungen/:id/matches`, ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const v = findVeranstaltung(user, Number(params.id));
		if (!v) return notFound();
		return HttpResponse.json(matchesFor(String(v.id)));
	}),

	// Fawkes-`DosController`-Kontrakt (siehe Issue #10, korrigiert #5/#7/#8): fixtureId statt
	// Veranstaltungs-UUID im Pfad, nur roundNo — kein setNo mehr.
	http.get(`${API_URL}/fixtures/:fixtureId/phase`, ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const fixtureId = Number(params.fixtureId);
		const v = findVeranstaltung(user, fixtureId);
		if (!v) return notFound();
		const roundNo = getCurrentRoundNo(String(v.id)) ?? 1;
		return HttpResponse.json({ roundNo, fixtureId });
	}),

	http.put(`${API_URL}/fixtures/:fixtureId/phase`, async ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const fixtureId = Number(params.fixtureId);
		const v = findVeranstaltung(user, fixtureId);
		if (!v) return notFound();
		const body = (await request.json()) as { roundNo?: number };
		if (typeof body.roundNo !== 'number') {
			return HttpResponse.json({ detail: 'roundNo fehlt oder ungültig' }, { status: 422 });
		}
		setCurrentRoundNo(String(v.id), body.roundNo);
		return HttpResponse.json({ roundNo: body.roundNo, fixtureId });
	}),

	http.get(`${API_URL}/veranstaltungen/:id/bildschirme`, ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const v = findVeranstaltung(user, Number(params.id));
		if (!v) return notFound();
		return HttpResponse.json(bildschirmeFor(String(v.id)));
	}),

	http.patch(
		`${API_URL}/veranstaltungen/:id/bildschirme/:bildschirmId`,
		async ({ request, params }) => {
			const user = requireUser(request);
			if (!user) return unauthorized();
			const v = findVeranstaltung(user, Number(params.id));
			if (!v) return notFound();
			const body = await request.json();
			const updated = updateBildschirm(
				String(v.id),
				String(params.bildschirmId),
				body as Parameters<typeof updateBildschirm>[2]
			);
			if (!updated)
				return HttpResponse.json({ detail: 'Bildschirm nicht gefunden' }, { status: 404 });
			return HttpResponse.json(updated);
		}
	),

	http.post(`${API_URL}/veranstaltungen/:id/bildschirme`, async ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const v = findVeranstaltung(user, Number(params.id));
		if (!v) return notFound();
		const body = (await request.json()) as { name?: string };
		return HttpResponse.json(createBildschirm(String(v.id), body.name ?? 'Bildschirm'), {
			status: 201
		});
	}),

	http.post(`${API_URL}/veranstaltungen/:id/tablet-token`, async ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const v = findVeranstaltung(user, Number(params.id));
		if (!v) return notFound();
		const body = (await request.json()) as { scheibennummer?: number };
		if (typeof body.scheibennummer !== 'number') {
			return HttpResponse.json({ detail: 'scheibennummer fehlt oder ungültig' }, { status: 422 });
		}
		return HttpResponse.json(generateTabletToken(String(v.id), body.scheibennummer));
	}),

	// Fixture-Mitgliedschaft (Fawkes `FixtureController`, siehe Issue #13) — eigene Achse
	// gegenüber der Account-`role`, gated auf `isOwner` PRO Fixture, nicht global.
	http.get(`${API_URL}/Fixture/:fixtureId/users`, ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const v = findVeranstaltung(user, Number(params.fixtureId));
		if (!v) return notFound();
		return HttpResponse.json(usersFor(String(v.id)));
	}),

	http.post(`${API_URL}/Fixture/:fixtureId/users/add`, async ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const v = findVeranstaltung(user, Number(params.fixtureId));
		if (!v) return notFound();
		if (!isFixtureOwner(String(v.id), user.email)) return forbidden();
		const body = (await request.json()) as { userName?: string };
		if (!body.userName) {
			return HttpResponse.json({ detail: 'userName fehlt' }, { status: 422 });
		}
		return HttpResponse.json(addFixtureUser(String(v.id), body.userName));
	}),

	http.delete(`${API_URL}/Fixture/:fixtureId/users/:userName`, ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const v = findVeranstaltung(user, Number(params.fixtureId));
		if (!v) return notFound();
		if (!isFixtureOwner(String(v.id), user.email)) return forbidden();
		return HttpResponse.json(
			removeFixtureUser(String(v.id), decodeURIComponent(String(params.userName)))
		);
	})
];
