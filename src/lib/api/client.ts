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
	if (res.status === 204) return undefined as T;
	return res.json();
}

export const apiClient = {
	get: <T>(endpoint: string, token?: string | null) =>
		request<T>(endpoint, { method: 'GET' }, token),

	post: <T>(endpoint: string, body: unknown, token?: string | null) =>
		request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }, token),

	patch: <T>(endpoint: string, body: unknown, token?: string | null) =>
		request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }, token),

	delete: <T>(endpoint: string, token?: string | null) =>
		request<T>(endpoint, { method: 'DELETE' }, token)
};
