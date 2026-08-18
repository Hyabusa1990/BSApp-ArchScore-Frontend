import { apiClient } from './client';

/**
 * Geräteverwaltung, siehe FACHLICHKEIT.md "Bildschirm-Pairing". Seit Issue #15 gegen den
 * echten Fawkes-`DeviceManagementController` verdrahtet — Tablets pro einzelner Scheibe
 * (`TabletPairing`) bleiben ein eigener, unveränderter Mechanismus (kein Fawkes-Kontrakt dafür).
 *
 * Wichtige Verhaltensänderung ggü. dem alten Mock-only-Modell: kein `pin`/`scheibe_a`/
 * `scheibe_b`/`mode`/`aktiv` mehr. Ein Gerät registriert sich selbst (`GET /Display/register`,
 * eigener, hier NICHT angefasster Mechanismus — siehe `displays.ts`/`handlers/display.ts`) und
 * bekommt dabei einen `deviceCode`. Der Admin ordnet dieses schon registrierte Gerät per
 * `deviceCode` einer Fixture zu (`assign`), danach nur noch `displayType`
 * (`None`/`Match`/`LigaTable`, Issue #18) + optional `matchNo` (nur bei `Match`) konfigurierbar.
 * Welche zwei Scheiben bei `Match` angezeigt werden, leitet das Backend selbst ab
 * (`GET /Display/data`) — keine manuelle Scheiben-Paar-Auswahl mehr.
 */

export type DisplayType = 'None' | 'Match' | 'LigaTable';

/** `Fawkes.Api.Controllers.DeviceManagementController.GetDeviceResponse`. */
export interface Device {
	id: number;
	displayType: DisplayType;
	/** Nur relevant bei `displayType === 'Match'`. */
	matchNo: number | null;
}

export interface UpdateDeviceData {
	displayType: DisplayType;
	matchNo: number | null;
}

export interface TabletPairing {
	scheibennummer: number;
	token: string;
}

export const bildschirmeApi = {
	list: (token: string, fixtureId: number) =>
		apiClient.get<Device[]>(`/fixtures/${fixtureId}/devices`, token),

	get: (token: string, fixtureId: number, deviceId: number) =>
		apiClient.get<Device>(`/fixtures/${fixtureId}/devices/${deviceId}`, token),

	// Setzt voraus, dass sich das Gerät bereits selbst registriert hat (deviceCode existiert).
	assign: (token: string, fixtureId: number, deviceCode: string) =>
		apiClient.put<Device>(`/fixtures/${fixtureId}/devices/assign`, { deviceCode }, token),

	update: (token: string, fixtureId: number, deviceId: number, data: UpdateDeviceData) =>
		apiClient.put<Device>(`/fixtures/${fixtureId}/devices/${deviceId}`, data, token),

	unassign: (token: string, fixtureId: number, deviceId: number) =>
		apiClient.put<void>(`/fixtures/${fixtureId}/devices/${deviceId}/unassign`, undefined, token),

	// Tablet-Pairing bleibt eigener Mock-only-Mechanismus (kein Fawkes-Endpunkt für Scheiben-
	// Enumeration) — veranstaltungId ist der Routen-String-Parameter, nicht die Fixture-ID.
	generateTabletToken: (token: string, veranstaltungId: string, scheibennummer: number) =>
		apiClient.post<TabletPairing>(
			`/veranstaltungen/${veranstaltungId}/tablet-token`,
			{ scheibennummer },
			token
		)
};
