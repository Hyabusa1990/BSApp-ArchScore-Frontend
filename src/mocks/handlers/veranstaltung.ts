import { http, HttpResponse } from 'msw';
import { API_URL } from '$lib/config';
import type { User } from '$lib/api/auth';
import { userFromAccessToken } from '../db';
import {
	activateMatch,
	bildschirmeFor,
	clearTabelle,
	connectLiga,
	createBildschirm,
	deactivateMatch,
	findVeranstaltung,
	generateTabletToken,
	matchesFor,
	removeVeranstaltung,
	setTabelle,
	updateBildschirm,
	visibleVeranstaltungen,
	createVeranstaltung
} from '../veranstaltungen';

/**
 * Verwaltungsoberfläche: einziger Bereich mit echtem Account-Login (bestehender
 * access_token, siehe auth.ts/db.ts) statt der zweckgebundenen Tokens von
 * Display/Binocular. Ownership-Filterung passiert hier, nicht auf Routen-Ebene
 * (siehe Issue #6 — kein role==="admin"-Gate, jeder eingeloggte Account darf rein,
 * sieht aber nur, was für ihn sichtbar ist).
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

export const veranstaltungHandlers = [
	http.get(`${API_URL}/veranstaltungen`, ({ request }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		return HttpResponse.json(visibleVeranstaltungen(user));
	}),

	http.post(`${API_URL}/veranstaltungen`, async ({ request }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const body = (await request.json()) as { name?: string };
		if (!body.name) {
			return HttpResponse.json(
				{ errors: [{ field: 'name', message: 'Pflichtfeld darf nicht leer sein' }] },
				{ status: 422 }
			);
		}
		return HttpResponse.json(createVeranstaltung(user, body.name), { status: 201 });
	}),

	http.get(`${API_URL}/veranstaltungen/:id`, ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const v = findVeranstaltung(user, String(params.id));
		if (!v) return notFound();
		return HttpResponse.json(v);
	}),

	http.delete(`${API_URL}/veranstaltungen/:id`, ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		if (!removeVeranstaltung(user, String(params.id))) return notFound();
		return new HttpResponse(null, { status: 204 });
	}),

	http.post(`${API_URL}/veranstaltungen/:id/tabelle`, async ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const v = findVeranstaltung(user, String(params.id));
		if (!v) return notFound();
		const body = (await request.json()) as { eintraege?: NonNullable<typeof v.tabelle> };
		return HttpResponse.json(setTabelle(v, body.eintraege ?? []));
	}),

	http.delete(`${API_URL}/veranstaltungen/:id/tabelle`, ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const v = findVeranstaltung(user, String(params.id));
		if (!v) return notFound();
		return HttpResponse.json(clearTabelle(v));
	}),

	http.post(`${API_URL}/veranstaltungen/:id/liga`, async ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const v = findVeranstaltung(user, String(params.id));
		if (!v) return notFound();
		const body = (await request.json()) as NonNullable<typeof v.liga>;
		return HttpResponse.json(connectLiga(v, body));
	}),

	http.get(`${API_URL}/veranstaltungen/:id/matches`, ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const v = findVeranstaltung(user, String(params.id));
		if (!v) return notFound();
		return HttpResponse.json(matchesFor(v.id));
	}),

	http.post(`${API_URL}/veranstaltungen/:id/matches/:matchId/activate`, ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const v = findVeranstaltung(user, String(params.id));
		if (!v) return notFound();
		const updated = activateMatch(v.id, String(params.matchId));
		if (!updated) return HttpResponse.json({ detail: 'Match nicht gefunden' }, { status: 404 });
		return HttpResponse.json(updated);
	}),

	http.post(`${API_URL}/veranstaltungen/:id/matches/:matchId/deactivate`, ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const v = findVeranstaltung(user, String(params.id));
		if (!v) return notFound();
		const updated = deactivateMatch(v.id, String(params.matchId));
		if (!updated) return HttpResponse.json({ detail: 'Match nicht gefunden' }, { status: 404 });
		return HttpResponse.json(updated);
	}),

	http.get(`${API_URL}/veranstaltungen/:id/bildschirme`, ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const v = findVeranstaltung(user, String(params.id));
		if (!v) return notFound();
		return HttpResponse.json(bildschirmeFor(v.id));
	}),

	http.patch(
		`${API_URL}/veranstaltungen/:id/bildschirme/:bildschirmId`,
		async ({ request, params }) => {
			const user = requireUser(request);
			if (!user) return unauthorized();
			const v = findVeranstaltung(user, String(params.id));
			if (!v) return notFound();
			const body = await request.json();
			const updated = updateBildschirm(
				v.id,
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
		const v = findVeranstaltung(user, String(params.id));
		if (!v) return notFound();
		const body = (await request.json()) as { name?: string };
		return HttpResponse.json(createBildschirm(v.id, body.name ?? 'Bildschirm'), { status: 201 });
	}),

	http.post(`${API_URL}/veranstaltungen/:id/tablet-token`, async ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const v = findVeranstaltung(user, String(params.id));
		if (!v) return notFound();
		const body = (await request.json()) as { scheibennummer?: number };
		if (typeof body.scheibennummer !== 'number') {
			return HttpResponse.json({ detail: 'scheibennummer fehlt oder ungültig' }, { status: 422 });
		}
		return HttpResponse.json(generateTabletToken(v.id, body.scheibennummer));
	})
];
