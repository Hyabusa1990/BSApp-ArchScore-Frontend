import { PUBLIC_ALLOW_REGISTRATION } from '$env/static/public';

export const API_URL = '/api';

// Kein Backend-Endpunkt dafür (Fawkes kennt kein GET /config) — zu Build-Zeit aus ENV
// eingebacken, gleiches Pattern wie PUBLIC_USE_MOCKS in src/routes/+layout.ts.
export const ALLOW_REGISTRATION = PUBLIC_ALLOW_REGISTRATION === 'true';
