<script lang="ts">
	import { binocularApi, type BinocularMatch } from '$lib/api/binocular';
	import { APIError } from '$lib/api/client';
	import { adjustSetScore, SET_ARROWS, setScoreOf } from '$lib/set-score';
	import { normalizeShots } from '$lib/shots';
	import QrScanModal from '$lib/components/QrScanModal.svelte';
	import ConnectivityBanner from '$lib/components/ConnectivityBanner.svelte';
	import { connectivity } from '$lib/stores/connectivity.svelte';
	import { _ } from 'svelte-i18n';
	import { Alert, Spinner } from '@sveltestrap/sveltestrap';

	/**
	 * Abgespeckte Ansicht für die Mannschaft (Schützen) an der Scheibe: nur die Satzsumme mit
	 * +/−, keine Einzelpfeile. Die Summenänderung wird per `adjustSetScore` auf den
	 * `shots`-String verteilt (Fawkes kennt keine Summe) und erst beim Bestätigen gesendet
	 * (`PUT .../shots`, danach `.../shots/confirm`). Kein Live-Sync zum Spotter-Tablet, wer
	 * zuerst bestätigt, gewinnt.
	 */

	// Wie auf der Spotter-Seite: 409 ROUND_NOT_STARTED oder 404 = noch keine Freigabe.
	function isWaiting(err: unknown): boolean {
		return (
			err instanceof APIError &&
			(err.status === 404 ||
				(err.status === 409 && (err.data as { code?: string })?.code === 'ROUND_NOT_STARTED'))
		);
	}

	let { data } = $props<{ data: { fixtureUniqueId: string; targetNo: number } }>();
	const token = $derived(data.fixtureUniqueId);
	const targetNo = $derived(data.targetNo);

	type ViewState = 'LOADING' | 'ERROR' | 'WAITING' | 'READY' | 'EXPIRED';

	let view = $state<ViewState>('LOADING');
	let matchData = $state<BinocularMatch | null>(null);
	let actionError = $state<string | null>(null);
	let saving = $state(false);
	// Scheibenwechsel: neuen Team-QR scannen (oben mittig, auch bei abgelaufenem Link nutzbar).
	let qrModalOpen = $state(false);

	// Lokale Korrektur: `edited` ist der geänderte shots-String, `editBase` der Serverstand
	// (shots + Satznummer), auf dem die Änderung aufsetzt. Ändert sich der Serverstand
	// darunter (Spotter hat Pfeile geändert, Satz bestätigt/gewechselt), wird sie verworfen.
	let edited = $state<string | null>(null);
	let editBase = $state<{ shots: string; setNo: number } | null>(null);

	const serverShots = $derived(normalizeShots(matchData?.shots));
	const arrowCount = $derived(serverShots.length);
	const matchComplete = $derived(matchData?.matchComplete === true);
	const locked = $derived(matchData?.isConfirmed === true || matchComplete);
	const complete = $derived(arrowCount === SET_ARROWS);
	const editable = $derived(complete && !locked && !saving);
	const currentShots = $derived(edited ?? serverShots);
	const sum = $derived(complete ? setScoreOf(currentShots) : (matchData?.currentSetScore ?? 0));
	const canDecrease = $derived(editable && adjustSetScore(currentShots, -1) !== null);
	const canIncrease = $derived(editable && adjustSetScore(currentShots, 1) !== null);

	function applyServerState(md: BinocularMatch) {
		matchData = md;
		const shots = normalizeShots(md.shots);
		if (
			edited !== null &&
			(md.isConfirmed ||
				md.matchComplete ||
				editBase?.shots !== shots ||
				editBase?.setNo !== md.currentSetNo)
		) {
			edited = null;
			editBase = null;
		}
	}

	function change(delta: 1 | -1) {
		if (!editable || !matchData) return;
		const next = adjustSetScore(currentShots, delta);
		if (next === null) return;
		if (edited === null) editBase = { shots: serverShots, setNo: matchData.currentSetNo };
		edited = next;
		actionError = null;
	}

	async function confirm() {
		if (!editable || !matchData || saving) return;
		saving = true;
		actionError = null;
		try {
			if (edited !== null && edited !== serverShots) {
				applyServerState(await binocularApi.putShots(token, targetNo, edited));
			}
			edited = null;
			editBase = null;
			applyServerState(await binocularApi.postBestaetigeSatz(token, targetNo));
		} catch (err) {
			// Mitten in der Sequenz kann der Stand abweichen (z. B. Spotter war schneller) —
			// Serverstand neu laden statt zu raten, die Sperre ergibt sich dann aus isConfirmed.
			try {
				edited = null;
				editBase = null;
				applyServerState(await binocularApi.getScheibe(token, targetNo));
			} catch {
				/* Fehleranzeige unten reicht */
			}
			const detail = err instanceof APIError ? (err.data as { detail?: string })?.detail : null;
			actionError = matchData?.isConfirmed ? null : (detail ?? $_('team.confirm_error'));
		} finally {
			saving = false;
		}
	}

	function handleLoadError(err: unknown) {
		if (isWaiting(err)) {
			matchData = null;
			view = 'WAITING';
		} else if (err instanceof APIError && err.status === 440) {
			matchData = null;
			view = 'EXPIRED';
		} else {
			view = 'ERROR';
		}
	}

	$effect(() => {
		let active = true;
		(async () => {
			try {
				const md = await binocularApi.getScheibe(token, targetNo);
				if (!active) return;
				applyServerState(md);
				view = 'READY';
			} catch (err) {
				if (active) handleLoadError(err);
			}
		})();
		return () => {
			active = false;
		};
	});

	// Polling alle 3 s wie auf der Spotter-Seite; während des Speicherns nicht synchronisieren.
	$effect(() => {
		if (view !== 'READY' && view !== 'WAITING') return;
		const interval = setInterval(async () => {
			if (saving) return;
			try {
				const md = await binocularApi.getScheibe(token, targetNo);
				connectivity.reportSuccess();
				if (saving) return;
				if (view === 'WAITING' || matchData?.teamName !== md.teamName) {
					edited = null;
					editBase = null;
				}
				applyServerState(md);
				view = 'READY';
			} catch (err) {
				if (isWaiting(err)) {
					connectivity.reportSuccess();
					edited = null;
					editBase = null;
					handleLoadError(err);
				} else if (err instanceof APIError && (err.status === 401 || err.status === 440)) {
					handleLoadError(err);
				} else {
					connectivity.reportFailure();
				}
			}
		}, 3000);
		return () => clearInterval(interval);
	});
</script>

<svelte:head>
	<title>{$_('team.page_title')}</title>
</svelte:head>

<button
	type="button"
	class="qr-trigger-btn"
	aria-label={$_('qr_scan.title')}
	onclick={() => (qrModalOpen = true)}
>
	<i class="bi bi-qr-code-scan"></i>
</button>

<QrScanModal kind="team" isOpen={qrModalOpen} onClose={() => (qrModalOpen = false)} />

<ConnectivityBanner variant="prominent" />

{#if view === 'LOADING'}
	<div class="d-flex justify-content-center align-items-center min-vh-100">
		<Spinner />
	</div>
{:else if view === 'ERROR'}
	<div class="p-3">
		<Alert color="danger">{$_('team.load_error')}</Alert>
	</div>
{:else if view === 'EXPIRED'}
	<div class="d-flex flex-column align-items-center justify-content-center min-vh-100 p-3">
		<Alert color="warning" class="text-center py-4 w-100 mb-0">
			<i class="bi bi-qr-code-scan fs-1 d-block mb-3"></i>
			<h5 class="fw-bold mb-2">{$_('team.expired_title')}</h5>
			<p class="mb-3 small">{$_('team.expired_hint')}</p>
			<button type="button" class="btn btn-warning" onclick={() => (qrModalOpen = true)}>
				{$_('binocular.expired_rescan_btn')}
			</button>
		</Alert>
	</div>
{:else if view === 'WAITING'}
	<div class="d-flex flex-column align-items-center justify-content-center min-vh-100 p-3">
		<span class="small text-muted mb-3"
			>{$_('team.lane_label', { values: { lane: targetNo } })}</span
		>
		<Alert color="warning" class="text-center py-4 w-100 mb-0">
			<i class="bi bi-hourglass-split fs-1 d-block mb-3"></i>
			<h5 class="fw-bold mb-2">{$_('team.waiting_title')}</h5>
			<p class="mb-0 small">{$_('team.waiting_release_hint')}</p>
		</Alert>
	</div>
{:else if view === 'READY' && matchData}
	<div class="team-page d-flex flex-column">
		<div class="border-bottom px-3 pb-2 text-center">
			<span class="small text-muted">
				{$_('team.lane_label', { values: { lane: targetNo } })} ·
				{$_('team.set_label', { values: { n: matchData.currentSetNo } })}
			</span>
			<div class="fw-bold text-truncate">{matchData.teamName}</div>
		</div>

		<!-- Mitte: Satzsumme + Statushinweise. -->
		<div class="flex-grow-1 d-flex flex-column align-items-center justify-content-center p-3">
			<div class="small text-muted text-uppercase mb-2">{$_('team.sum_label')}</div>
			<div class="sum-value" class:sum-muted={!complete}>{complete ? sum : '–'}</div>

			{#if actionError}
				<Alert color="danger" class="py-2 mt-3 mb-0 w-100">{actionError}</Alert>
			{/if}

			{#if matchComplete}
				<Alert color="info" class="text-center mt-4 mb-0 w-100 py-3">
					<i class="bi bi-check2-circle fs-2 d-block mb-2"></i>
					{$_('team.match_complete')}
				</Alert>
			{:else if locked}
				<Alert color="info" class="text-center mt-4 mb-0 w-100 py-3">
					<i class="bi bi-check2-circle fs-2 d-block mb-2"></i>
					{$_('team.confirmed_waiting')}
				</Alert>
			{:else if !complete}
				<Alert color="secondary" class="text-center mt-4 mb-0 w-100 py-3">
					<i class="bi bi-hourglass-split fs-2 d-block mb-2"></i>
					{$_('team.waiting_spotter', { values: { count: arrowCount } })}
				</Alert>
			{/if}
		</div>

		<!-- Unteres Drittel: Bedienelemente in Daumenreichweite (einhändig am Smartphone). -->
		<div class="team-controls px-3 pb-3 d-flex flex-column justify-content-end gap-3">
			<div class="sum-row">
				<button
					type="button"
					class="btn btn-outline-danger sum-btn"
					aria-label={$_('team.sum_decrease')}
					disabled={!canDecrease}
					onclick={() => change(-1)}
				>
					<i class="bi bi-dash-lg"></i>
				</button>
				<button
					type="button"
					class="btn btn-outline-success sum-btn"
					aria-label={$_('team.sum_increase')}
					disabled={!canIncrease}
					onclick={() => change(1)}
				>
					<i class="bi bi-plus-lg"></i>
				</button>
			</div>
			<button
				type="button"
				class="btn btn-success w-100 py-3 fw-bold fs-4"
				disabled={!editable}
				onclick={confirm}
			>
				{#if saving}
					<Spinner size="sm" class="me-2" />
				{/if}
				{$_('team.confirm_btn')}
			</button>
		</div>
	</div>
{/if}

<style>
	.qr-trigger-btn {
		position: fixed;
		top: 0.5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 1050;
		width: 36px;
		height: 36px;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.06);
		color: rgba(0, 0, 0, 0.45);
		font-size: 1.1rem;
	}

	.team-page {
		max-width: 32rem;
		margin: 0 auto;
		min-height: 100dvh;
		/* Platz für den fixen QR-Trigger oben mittig */
		padding-top: 3rem;
	}

	.sum-value {
		text-align: center;
		font-size: clamp(5rem, 28vw, 9rem);
		font-weight: 800;
		line-height: 1;
	}

	.sum-muted {
		color: #adb5bd;
	}

	/* Unteres Drittel des Bildschirms: ± und Bestätigen. */
	.team-controls {
		min-height: 33dvh;
		padding-bottom: max(1rem, env(safe-area-inset-bottom)) !important;
	}

	.sum-row {
		display: flex;
		gap: 1rem;
	}

	.sum-btn {
		flex: 1;
		height: clamp(80px, 14dvh, 120px);
		font-size: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
	}
</style>
