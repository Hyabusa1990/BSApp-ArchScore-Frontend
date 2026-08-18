import { http, HttpResponse } from 'msw';
import { API_URL } from '$lib/config';
import type { User } from '$lib/api/auth';
import type { UpdateDeviceData } from '$lib/api/bildschirme';
import { userFromAccessToken } from '../db';
import {
	assignDevice,
	devicesFor,
	findDevice,
	findVeranstaltung,
	unassignDevice,
	updateDevice
} from '../veranstaltungen';

/**
 * Fawkes-`DeviceManagementController`-Kontrakt (siehe Issue #15) — eigene Handler-Datei statt
 * Mitbenutzung von `handlers/veranstaltung.ts`, weil die Ressource jetzt "devices" heißt und
 * ein eigenes Feature-Modul (`src/lib/api/bildschirme.ts`) ist (CLAUDE.md „eine Handler-Datei
 * pro Feature-Modul"). Ersetzt die alten `/veranstaltungen/:id/bildschirme...`-Endpunkte
 * vollständig — die zugehörige Mock-Verwaltungs-UI ist auf dieses Device-Modell umgestellt.
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

export const deviceHandlers = [
	http.get(`${API_URL}/fixtures/:fixtureId/devices`, ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const v = findVeranstaltung(user, Number(params.fixtureId));
		if (!v) return notFound();
		return HttpResponse.json(devicesFor(String(v.id)));
	}),

	// VOR `/devices/:deviceId` registriert — sonst würde MSW "assign" als deviceId matchen.
	http.put(`${API_URL}/fixtures/:fixtureId/devices/assign`, async ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const v = findVeranstaltung(user, Number(params.fixtureId));
		if (!v) return notFound();
		const body = (await request.json()) as { deviceCode?: string };
		if (!body.deviceCode) {
			return HttpResponse.json({ detail: 'deviceCode fehlt' }, { status: 422 });
		}
		const device = assignDevice(String(v.id), body.deviceCode);
		if (!device) {
			return HttpResponse.json(
				{ detail: 'deviceCode unbekannt oder bereits zugewiesen' },
				{ status: 404 }
			);
		}
		return HttpResponse.json(device);
	}),

	http.get(`${API_URL}/fixtures/:fixtureId/devices/:deviceId`, ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const v = findVeranstaltung(user, Number(params.fixtureId));
		if (!v) return notFound();
		const device = findDevice(String(v.id), Number(params.deviceId));
		if (!device) return HttpResponse.json({ detail: 'Gerät nicht gefunden' }, { status: 404 });
		return HttpResponse.json(device);
	}),

	http.put(`${API_URL}/fixtures/:fixtureId/devices/:deviceId`, async ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const v = findVeranstaltung(user, Number(params.fixtureId));
		if (!v) return notFound();
		const body = (await request.json()) as Partial<UpdateDeviceData>;
		if (body.displayType !== 'None' && body.displayType !== 'Match') {
			return HttpResponse.json({ detail: 'displayType fehlt oder ungültig' }, { status: 422 });
		}
		const device = updateDevice(String(v.id), Number(params.deviceId), {
			displayType: body.displayType,
			matchNo: body.matchNo ?? null
		});
		if (!device) return HttpResponse.json({ detail: 'Gerät nicht gefunden' }, { status: 404 });
		return HttpResponse.json(device);
	}),

	http.put(`${API_URL}/fixtures/:fixtureId/devices/:deviceId/unassign`, ({ request, params }) => {
		const user = requireUser(request);
		if (!user) return unauthorized();
		const v = findVeranstaltung(user, Number(params.fixtureId));
		if (!v) return notFound();
		if (!unassignDevice(String(v.id), Number(params.deviceId))) {
			return HttpResponse.json({ detail: 'Gerät nicht gefunden' }, { status: 404 });
		}
		return HttpResponse.json({});
	})
];
