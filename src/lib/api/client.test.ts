import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiClient, setTokenRefresher } from './client';

type Call = { url: string; auth: string | undefined };

function mockFetch(handler: (call: Call) => Response) {
	const calls: Call[] = [];
	globalThis.fetch = (async (url: string, init: RequestInit) => {
		const call = { url, auth: (init.headers as Record<string, string>)['Authorization'] };
		calls.push(call);
		return handler(call);
	}) as typeof fetch;
	return calls;
}

test('401 mit erneuerbarem Token: Request wird einmal mit frischem Token wiederholt', async () => {
	setTokenRefresher(async (failed) => (failed === 'old' ? 'new' : null));
	const calls = mockFetch((c) =>
		c.auth === 'Bearer new' ? Response.json({ ok: true }) : new Response('{}', { status: 401 })
	);
	assert.deepEqual(await apiClient.get('/fixtures', 'old'), { ok: true });
	assert.deepEqual(
		calls.map((c) => c.auth),
		['Bearer old', 'Bearer new']
	);
});

test('401 ohne frisches Token: APIError, kein Retry', async () => {
	setTokenRefresher(async () => null);
	const calls = mockFetch(() => new Response('{}', { status: 401 }));
	await assert.rejects(apiClient.get('/fixtures', 'device'), { status: 401 });
	assert.equal(calls.length, 1);
});

test('Auth-Endpunkte lösen keinen Refresh aus', async () => {
	let refreshed = false;
	setTokenRefresher(async () => ((refreshed = true), 'new'));
	mockFetch(() => new Response('{}', { status: 401 }));
	await assert.rejects(apiClient.get('/Auth/me', 'old'), { status: 401 });
	assert.equal(refreshed, false);
});
