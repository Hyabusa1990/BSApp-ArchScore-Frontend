import { http, HttpResponse } from 'msw';
import { API_URL } from '$lib/config';

/** Noch nicht in openapi.yaml spezifiziert — reines Frontend-Bedürfnis bisher. */
export const configHandlers = [
	http.get(`${API_URL}/config`, () => HttpResponse.json({ allow_registration: true }))
];
