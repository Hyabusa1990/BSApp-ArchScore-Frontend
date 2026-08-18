<script lang="ts">
	import { browser } from '$app/environment';
	import { displayApi, type DisplaySeite, type LigaTableEintrag } from '$lib/api/display';
	import { APIError } from '$lib/api/client';
	import { _ } from 'svelte-i18n';
	import { Spinner } from '@sveltestrap/sveltestrap';
	import MonitorTeamBlock from '$lib/components/MonitorTeamBlock.svelte';
	import DisplayLigaTable from '$lib/components/DisplayLigaTable.svelte';
	import type { DisplayTheme } from './+page';

	let { data } = $props<{ data: { theme: DisplayTheme } }>();

	const ACCESS_TOKEN_KEY = 'display_access_token';
	const REFRESH_TOKEN_KEY = 'display_refresh_token';
	const DEVICE_CODE_KEY = 'display_device_code';

	type ViewState = 'LOADING' | 'PAIRING' | 'IDLE' | 'CONTENT' | 'LIGA_TABLE';

	let view = $state<ViewState>('LOADING');
	let pairingCode = $state<string | null>(null);
	let scheibeA = $state<DisplaySeite | null>(null);
	let scheibeB = $state<DisplaySeite | null>(null);
	let ligaTable = $state<LigaTableEintrag[]>([]);
	let loadError = $state<string | null>(null);

	// Satzpunkte kommen unverändert aus der aufbereiteten Backend-Antwort — Vergleich nur zur
	// Einfärbung (grün/rot), keine eigene Ergebnisberechnung (siehe FACHLICHKEIT.md).
	const satzpunkteVergleichbar = $derived(
		scheibeA?.setPoints != null && scheibeB?.setPoints != null
	);
	const aSatzpunkteFuehrt = $derived(
		satzpunkteVergleichbar && scheibeA!.setPoints! > scheibeB!.setPoints!
	);
	const bSatzpunkteFuehrt = $derived(
		satzpunkteVergleichbar && scheibeB!.setPoints! > scheibeA!.setPoints!
	);

	// `.monitor-page` deckt die Fläche zwar sofort themengerecht ab, aber `<body>` bleibt beim
	// Overscroll-Bounce auf Touch-Geräten sichtbar (iOS Safari o.ä.) — ohne das hier bliebe der
	// Rand dort immer dunkel, auch im Light-Theme.
	$effect(() => {
		if (!browser) return;
		document.body.style.background = data.theme === 'light' ? '#f4f5f7' : '#10151c';
	});

	// ── Pairing + Polling in einer Schleife ─────────────────────────────────────
	// Erster Aufruf ohne accessToken: Gerät registrieren (`GET /Display/register`), Token +
	// deviceCode lokal merken. Danach durchgehend alle 3s `GET /Display/data` pollen — solange
	// `Unassigned` bleibt der deviceCode sichtbar (Admin trägt ihn beim Zuordnen ein), sobald
	// zugeordnet wird automatisch zur Anzeige gewechselt.
	//
	// Ein 401 bedeutet nur "accessToken abgelaufen", NICHT "Gerät neu registrieren" (Issue #19,
	// Wunsch Gero 2026-08-18) — der `deviceCode` (und damit die Fixture-Zuordnung, die der Admin
	// bereits gemacht hat!) soll erhalten bleiben, solange sich das Gerät noch irgendwie
	// authentifizieren kann. Erst wenn auch das `refreshToken` nicht mehr akzeptiert wird (selbst
	// abgelaufen/ungültig), gilt die Session als komplett verloren und der nächste Tick
	// registriert wirklich neu (neuer `deviceCode`, Admin muss neu zuordnen).
	$effect(() => {
		if (!browser) return;
		let active = true;

		function persistTokens(accessToken: string, refreshToken: string) {
			localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
			localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
		}

		function clearSession() {
			localStorage.removeItem(ACCESS_TOKEN_KEY);
			localStorage.removeItem(REFRESH_TOKEN_KEY);
			localStorage.removeItem(DEVICE_CODE_KEY);
		}

		async function ensureAccessToken(): Promise<string> {
			const existing = localStorage.getItem(ACCESS_TOKEN_KEY);
			if (existing) return existing;
			const created = await displayApi.register();
			persistTokens(created.accessToken, created.refreshToken);
			localStorage.setItem(DEVICE_CODE_KEY, created.deviceCode);
			return created.accessToken;
		}

		/** `true` = erfolgreich rotiert, Aufrufer kann es mit dem neuen Token nochmal versuchen.
		 * `false` = auch das Refresh-Token ist tot, Session komplett weg. */
		async function tryRefresh(): Promise<boolean> {
			const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
			if (!refreshToken) return false;
			try {
				const rotated = await displayApi.refresh(refreshToken);
				persistTokens(rotated.accessToken, rotated.refreshToken);
				return true;
			} catch {
				return false;
			}
		}

		async function tick() {
			try {
				const accessToken = await ensureAccessToken();
				const data = await displayApi.getData(accessToken);
				if (!active) return;
				loadError = null;
				if (data.displayType === 'Unassigned') {
					pairingCode = localStorage.getItem(DEVICE_CODE_KEY);
					scheibeA = null;
					scheibeB = null;
					view = 'PAIRING';
				} else if (data.displayType === 'Match' && data.targets.length >= 2) {
					scheibeA = data.targets[0];
					scheibeB = data.targets[1];
					view = 'CONTENT';
				} else if (data.displayType === 'LigaTable') {
					ligaTable = data.ligaTable;
					view = 'LIGA_TABLE';
				} else {
					scheibeA = null;
					scheibeB = null;
					view = 'IDLE';
				}
			} catch (err) {
				if (!active) return;
				if (err instanceof APIError && err.status === 401) {
					if (!(await tryRefresh())) clearSession();
					return; // nächster Tick versucht es mit rotiertem Token bzw. registriert neu
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

<div class="monitor-page" class:theme-light={data.theme === 'light'}>
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
			<div class="monitor-pairing-code">{pairingCode}</div>
			<p class="monitor-pairing-waiting">
				<Spinner size="sm" class="me-2" />{$_('display.pairing_waiting')}
			</p>
		</div>
	{:else if view === 'IDLE'}
		<div class="monitor-center">
			<p class="monitor-pairing-hint">{$_('display.idle_hint')}</p>
		</div>
	{:else if view === 'LIGA_TABLE'}
		<DisplayLigaTable eintraege={ligaTable} />
	{:else if view === 'CONTENT' && scheibeA && scheibeB}
		<div class="monitor-content">
			<MonitorTeamBlock
				seite={scheibeA}
				satzpunkteFuehrt={aSatzpunkteFuehrt}
				satzpunkteZurueck={bSatzpunkteFuehrt}
				gegnerSetScores={scheibeB.setScores ?? null}
			/>
			<div class="monitor-divider"><span>VS</span></div>
			<MonitorTeamBlock
				seite={scheibeB}
				rechtsOrientiert
				satzpunkteFuehrt={bSatzpunkteFuehrt}
				satzpunkteZurueck={aSatzpunkteFuehrt}
				gegnerSetScores={scheibeA.setScores ?? null}
			/>
		</div>
	{/if}
</div>

<style>
	/*
	 * Alle Farbwerte laufen über CSS-Variablen statt fest verdrahteter Hex-Codes — `.theme-light`
	 * überschreibt unten nur die Werte, die sich ändern (Ring-/Status-Farben wie
	 * grün/rot/gelb/blau bleiben in beiden Themes gleich, das sind Zielscheiben-Farben, keine
	 * UI-Farben). Custom Properties kaskadieren über den DOM-Baum, nicht über Sveltes
	 * Style-Scoping — `MonitorTeamBlock`/`DisplayLigaTable` können `var(--monitor-*)` deshalb
	 * ohne eigenes Theme-Prop einfach mitlesen, solange sie irgendwo unter `.monitor-page`
	 * gerendert werden. Default (kein `.theme-light`) = `dark`, siehe `+page.ts`.
	 */
	.monitor-page {
		--monitor-bg: #10151c;
		--monitor-fg: #f5f7fa;
		--monitor-muted: #9aa4b2;
		--monitor-elevated: #2a323d;
		--monitor-elevated-fg: #f5f7fa;
		--monitor-border: #495057;
		--monitor-points-bg: #495057;
		--monitor-points-fg: #fff;
		--monitor-chip-bg: rgba(255, 255, 255, 0.08);
		--monitor-divider-line: rgba(255, 255, 255, 0.15);
		--monitor-divider-fg: #6c757d;
		--monitor-row-border: rgba(255, 255, 255, 0.08);
		--monitor-row-even: rgba(255, 255, 255, 0.04);
		--monitor-ring-empty-bg: rgba(255, 255, 255, 0.06);
		--monitor-ring-empty-fg: #6c757d;
		--monitor-compare-equal-bg: #ced4da;
		--monitor-compare-equal-fg: #212529;
		--monitor-error: #dc3545;

		height: 100dvh;
		width: 100vw;
		overflow: hidden;
		background: var(--monitor-bg);
		color: var(--monitor-fg);
		display: flex;
		flex-direction: column;
	}

	.monitor-page.theme-light {
		--monitor-bg: #f4f5f7;
		--monitor-fg: #1b1f24;
		--monitor-muted: #667080;
		--monitor-elevated: #e7e9ec;
		--monitor-elevated-fg: #1b1f24;
		--monitor-border: #c3c9d1;
		--monitor-points-bg: #dfe3e8;
		--monitor-points-fg: #1b1f24;
		--monitor-chip-bg: rgba(0, 0, 0, 0.05);
		--monitor-divider-line: rgba(0, 0, 0, 0.12);
		--monitor-divider-fg: #8891a0;
		--monitor-row-border: rgba(0, 0, 0, 0.08);
		--monitor-row-even: rgba(0, 0, 0, 0.03);
		--monitor-ring-empty-bg: rgba(0, 0, 0, 0.05);
		--monitor-ring-empty-fg: #8891a0;
		--monitor-compare-equal-bg: #b9c0c8;
		--monitor-compare-equal-fg: #1b1f24;
		--monitor-error: #b02a37;
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
		color: var(--monitor-error);
		font-size: 1.2rem;
	}

	.monitor-pairing-hint {
		font-size: clamp(1.2rem, 2.5vw, 1.8rem);
		color: var(--monitor-muted);
	}

	.monitor-pairing-code {
		font-family: 'Courier New', monospace;
		font-size: clamp(3.5rem, 12vw, 8rem);
		font-weight: 800;
		letter-spacing: 0.2em;
		padding: 1rem 2rem;
		border: 4px solid var(--monitor-border);
		border-radius: 1rem;
	}

	.monitor-pairing-waiting {
		font-size: clamp(1rem, 1.8vw, 1.3rem);
		color: var(--monitor-muted);
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
		background: var(--monitor-divider-line);
	}

	.monitor-divider span {
		position: relative;
		background: var(--monitor-bg);
		padding: 0 1.5rem;
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--monitor-divider-fg);
		letter-spacing: 0.1em;
	}
</style>
