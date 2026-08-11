<script lang="ts">
	import { browser } from '$app/environment';
	import { displayApi, type DisplayContent } from '$lib/api/display';
	import { APIError } from '$lib/api/client';
	import { _ } from 'svelte-i18n';
	import { Spinner } from '@sveltestrap/sveltestrap';
	import MonitorTeamBlock from '$lib/components/MonitorTeamBlock.svelte';
	import DisplayTabelle from '$lib/components/DisplayTabelle.svelte';

	const JWT_KEY = 'display_jwt';
	const PIN_KEY = 'display_pin';

	type ViewState = 'LOADING' | 'PAIRING' | 'CONTENT';

	let view = $state<ViewState>('LOADING');
	let pairingPin = $state<string | null>(null);
	let content = $state<DisplayContent | null>(null);
	let loadError = $state<string | null>(null);

	// Satzpunkte kommen unverändert aus der aufbereiteten Backend-Antwort — Vergleich nur zur
	// Einfärbung (grün/rot), keine eigene Ergebnisberechnung (siehe FACHLICHKEIT.md).
	const satzpunkteVergleichbar = $derived(
		content?.scheibe_a?.satzpunkte != null && content?.scheibe_b?.satzpunkte != null
	);
	const aSatzpunkteFuehrt = $derived(
		satzpunkteVergleichbar && content!.scheibe_a!.satzpunkte! > content!.scheibe_b!.satzpunkte!
	);
	const bSatzpunkteFuehrt = $derived(
		satzpunkteVergleichbar && content!.scheibe_b!.satzpunkte! > content!.scheibe_a!.satzpunkte!
	);

	// ── Pairing + Polling in einer Schleife ─────────────────────────────────────
	// Erster Aufruf ohne JWT: Display registrieren, JWT + PIN lokal merken. Danach
	// durchgehend alle 3s pollen — solange unpaired bleibt der PIN sichtbar, sobald
	// gepaired wird automatisch zur Anzeige gewechselt. Ein 401 (JWT serverseitig
	// ungültig/gelöscht) setzt lokal zurück, der nächste Tick registriert selbstständig
	// neu — analog zum 404-Handling im scoring-Referenzprojekt.
	$effect(() => {
		if (!browser) return;
		let active = true;

		async function ensureJwt(): Promise<string> {
			const existing = localStorage.getItem(JWT_KEY);
			if (existing) return existing;
			const created = await displayApi.register();
			localStorage.setItem(JWT_KEY, created.jwt);
			localStorage.setItem(PIN_KEY, created.pin);
			return created.jwt;
		}

		async function tick() {
			try {
				const jwt = await ensureJwt();
				const data = await displayApi.getContent(jwt);
				if (!active) return;
				loadError = null;
				if (data.paired) {
					content = data;
					view = 'CONTENT';
				} else {
					pairingPin = localStorage.getItem(PIN_KEY);
					content = null;
					view = 'PAIRING';
				}
			} catch (err) {
				if (!active) return;
				if (err instanceof APIError && err.status === 401) {
					localStorage.removeItem(JWT_KEY);
					localStorage.removeItem(PIN_KEY);
					return; // nächster Tick registriert automatisch ein neues Display
				}
				loadError = $_('display.load_error');
			}
		}

		tick();
		const interval = setInterval(tick, 3000);
		return () => {
			active = false;
			clearInterval(interval);
		};
	});
</script>

<svelte:head>
	<title>{$_('display.page_title')}</title>
</svelte:head>

<div class="monitor-page">
	{#if view === 'LOADING'}
		<div class="monitor-center">
			<Spinner style="width: 4rem; height: 4rem;" />
			{#if loadError}
				<p class="monitor-error mt-4">{loadError}</p>
			{/if}
		</div>
	{:else if view === 'PAIRING'}
		<div class="monitor-center">
			<p class="monitor-pairing-hint">{$_('display.pairing_hint')}</p>
			<div class="monitor-pairing-code">{pairingPin}</div>
			<p class="monitor-pairing-waiting">
				<Spinner size="sm" class="me-2" />{$_('display.pairing_waiting')}
			</p>
		</div>
	{:else if view === 'CONTENT' && content}
		{#if content.mode === 'ergebnisse'}
			<div class="monitor-content">
				<MonitorTeamBlock
					seite={content.scheibe_a!}
					satzpunkteFuehrt={aSatzpunkteFuehrt}
					satzpunkteZurueck={bSatzpunkteFuehrt}
				/>
				<div class="monitor-divider"><span>VS</span></div>
				<MonitorTeamBlock
					seite={content.scheibe_b!}
					rechtsOrientiert
					satzpunkteFuehrt={bSatzpunkteFuehrt}
					satzpunkteZurueck={aSatzpunkteFuehrt}
				/>
			</div>
		{:else}
			<DisplayTabelle eintraege={content.tabelle ?? []} />
		{/if}
	{/if}
</div>

<style>
	:global(body) {
		background: #10151c;
	}

	.monitor-page {
		height: 100dvh;
		width: 100vw;
		overflow: hidden;
		background: #10151c;
		color: #f5f7fa;
		display: flex;
		flex-direction: column;
	}

	.monitor-center {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		text-align: center;
		padding: 2rem;
	}

	.monitor-error {
		color: #dc3545;
		font-size: 1.2rem;
	}

	.monitor-pairing-hint {
		font-size: clamp(1.2rem, 2.5vw, 1.8rem);
		color: #c3cad3;
	}

	.monitor-pairing-code {
		font-family: 'Courier New', monospace;
		font-size: clamp(3.5rem, 12vw, 8rem);
		font-weight: 800;
		letter-spacing: 0.2em;
		padding: 1rem 2rem;
		border: 4px solid #495057;
		border-radius: 1rem;
	}

	.monitor-pairing-waiting {
		font-size: clamp(1rem, 1.8vw, 1.3rem);
		color: #9aa4b2;
		display: flex;
		align-items: center;
	}

	.monitor-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.monitor-divider {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}

	.monitor-divider::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		height: 1px;
		background: rgba(255, 255, 255, 0.15);
	}

	.monitor-divider span {
		position: relative;
		background: #10151c;
		padding: 0 1.5rem;
		font-size: 1.1rem;
		font-weight: 700;
		color: #6c757d;
		letter-spacing: 0.1em;
	}
</style>
