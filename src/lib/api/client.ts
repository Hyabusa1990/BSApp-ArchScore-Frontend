import { API_URL } from '$lib/config';

export class APIError extends Error {
	constructor(
		public readonly status: number,
		public readonly data: unknown
	) {
		super(`API Error ${status}`);
	}
}

async function request<T>(
	endpoint: string,
	options: RequestInit = {},
	token?: string | null
): Promise<T> {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (token) headers['Authorization'] = `Bearer ${token}`;
	Object.assign(headers, options.headers ?? {});

	const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });

	if (!res.ok) {
		const data = await res.json().catch(() => ({}));
		throw new APIError(res.status, data);
	}
	// Fawkes antwortet bei Aktionen ohne Response-Schema (z. B. POST .../matchplaychart, PUT .../score)
	// mit bare 200 und leerem Body — `res.json()` würde darauf werfen.
	const text = await res.text();
	return (text ? JSON.parse(text) : undefined) as T;
}

export const apiClient = {
	get: <T>(endpoint: string, token?: string | null) =>
		request<T>(endpoint, { method: 'GET' }, token),

	post: <T>(endpoint: string, body: unknown, token?: string | null) =>
		request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }, token),

	patch: <T>(endpoint: string, body: unknown, token?: string | null) =>
		request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }, token),

	put: <T>(endpoint: string, body: unknown, token?: string | null) =>
		request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }, token),

	delete: <T>(endpoint: string, token?: string | null) =>
		request<T>(endpoint, { method: 'DELETE' }, token)
};
