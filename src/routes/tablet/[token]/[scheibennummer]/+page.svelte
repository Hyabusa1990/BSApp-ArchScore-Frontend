<script lang="ts">
	import { binocularApi, type BinocularMatch, type VorlaeufigePasse } from '$lib/api/binocular';
	import { APIError } from '$lib/api/client';
	import { _ } from 'svelte-i18n';
	import { Alert, Spinner } from '@sveltestrap/sveltestrap';

	let { data } = $props<{ data: { token: string; scheibennummer: number } }>();
	const token = $derived(data.token);
	const scheibennummer = $derived(data.scheibennummer);

	type ViewState = 'LOADING' | 'ERROR' | 'WARTET' | 'READY';

	let view = $state<ViewState>('LOADING');
	let loadError = $state<string | null>(null);
	let matchData = $state<BinocularMatch | null>(null);
	let actionError = $state<string | null>(null);
	let sending = $state(false);

	// ── Satz-Anzeige (alle 6 Pfeile, nicht nur die letzte Passe) ────────────────
	// Lokal geführt (mirror der Backend-Positionslogik: Position = floor(n/2)+1),
	// damit der Wechsel in den nächsten Satz erst nach aktiver Bestätigung durch
	// den Spotter passiert — das Backend selbst kennt keinen "unbestätigten"
	// Zustand, es zählt einfach weiter. Die Bestätigung ist rein UI-seitig: erst
	// danach werden neue Pfeile für den nächsten Satz gesendet.
	let satz = $state(1);
	let arrows = $state<(number | null)[]>(emptyArrows());
	let confirmingSatzEnde = $state(false);
	let satzSaving = $state(false);
	let zeigeNiedrigeWerte = $state(false);
	// Index (0-5) eines bereits erfassten Pfeils, der gerade korrigiert wird —
	// null = normaler Modus (Tap füllt den nächsten freien Pfeil).
	let korrekturIndex = $state<number | null>(null);

	function emptyArrows(): (number | null)[] {
		return [null, null, null, null, null, null];
	}

	function arrowsFromPassen(passen: VorlaeufigePasse[]): (number | null)[] {
		const a = emptyArrows();
		for (const p of passen) {
			a[(p.position - 1) * 2] = p.ringzahl_pfeil1;
			a[(p.position - 1) * 2 + 1] = p.ringzahl_pfeil2;
		}
		return a;
	}

	const gefuellteAnzahl = $derived(arrows.filter((v) => v !== null).length);
	const aktivePosition = $derived(Math.min(Math.floor(gefuellteAnzahl / 2), 2));

	function uebernehmeMatchDaten(md: BinocularMatch) {
		matchData = md;
		satz = md.aktueller_satz;
		arrows = arrowsFromPassen(md.vorlaeufige_passen);
		confirmingSatzEnde = false;
		korrekturIndex = null;
		actionError = null;
	}

	// Nach 423 (Satz bereits vom Schützen final bestätigt): frischen Stand holen und lokal
	// zum nächsten noch nicht final bestätigten Satz weiterschalten. Das Backend zählt
	// aktueller_satz rein über vorlaeufige_passen weiter, kennt schuetze_bestaetigte_saetze
	// dabei nicht — das Weiterschalten übernimmt bewusst das Frontend.
	async function handleSatzGesperrt(gesperrterSatz: number) {
		actionError = $_('binocular.satz_gesperrt_info');
		try {
			const fresh = await binocularApi.getScheibe(token, scheibennummer);
			matchData = fresh;
			let naechsterSatz = gesperrterSatz;
			while (naechsterSatz <= 5 && fresh.schuetze_bestaetigte_saetze.includes(naechsterSatz)) {
				naechsterSatz += 1;
			}
			satz = naechsterSatz;
			arrows = emptyArrows();
			confirmingSatzEnde = false;
			korrekturIndex = null;
		} catch {
			/* Fehleranzeige oben reicht, wenn auch das fehlschlägt */
		}
	}

	// ── Laden ─────────────────────────────────────────────────────────────────
	// 401 (unbekannter/ungültiger Token) ist ein echter Fehler. 404 (bekannter Token,
	// aber kein aktives Match auf dieser Scheibe) ist ein normaler, erwartbarer
	// Zwischenzustand ("warte auf Freigabe") — siehe #4's saubere Statuscode-Trennung.

	$effect(() => {
		let active = true;
		(async () => {
			try {
				const md = await binocularApi.getScheibe(token, scheibennummer);
				if (!active) return;
				uebernehmeMatchDaten(md);
				view = 'READY';
			} catch (err) {
				if (!active) return;
				if (err instanceof APIError && err.status === 404) {
					view = 'WARTET';
				} else {
					loadError = $_('binocular.load_error');
					view = 'ERROR';
				}
			}
		})();
		return () => {
			active = false;
		};
	});

	// ── Polling ──────────────────────────────────────────────────────────────
	// In READY mit UNVERÄNDERTEM Match: rührt bewusst nicht an satz/arrows — das würde
	// die lokale Bestätigungslogik durcheinanderbringen (siehe Kommentar oben). In WARTET
	// oder wenn sich extern_match_id ändert (Rundenwechsel auf derselben Scheibe): vollständig
	// neu übernehmen, sonst blieben Satz-Stand/Korrekturmodus vom alten Match hängen.
	$effect(() => {
		if (view !== 'READY' && view !== 'WARTET') return;
		const interval = setInterval(async () => {
			try {
				const md = await binocularApi.getScheibe(token, scheibennummer);
				if (view === 'WARTET' || matchData?.extern_match_id !== md.extern_match_id) {
					uebernehmeMatchDaten(md);
					view = 'READY';
				} else {
					matchData = { ...matchData, status: md.status };
				}
			} catch (err) {
				if (err instanceof APIError && err.status === 404) {
					matchData = null;
					view = 'WARTET';
				} else if (err instanceof APIError && err.status === 401) {
					loadError = $_('binocular.load_error');
					view = 'ERROR';
				}
				/* sonst: Netzwerkfehler — nächste Runde versuchen */
			}
		}, 3000);
		return () => clearInterval(interval);
	});

	// ── Keypad ────────────────────────────────────────────────────────────────
	// 10-6 + M sind die häufigsten Werte bei der Fernglas-Erfassung und bleiben
	// groß und permanent sichtbar. 5-1 sind selten und stehen hinter einem
	// Ein-/Ausblenden-Button, damit die Haupttasten mehr Platz bekommen.

	const primaryKeys = [
		[10, 9, 8],
		[7, 6, 'M']
	] as const;
	const secondaryKeys = [5, 4, 3, 2, 1] as const;

	function keypadColor(key: number | string): string {
		if (key === 'M') return 'btn-success';
		const n = key as number;
		if (n >= 9) return 'btn-warning';
		if (n >= 7) return 'btn-danger';
		if (n >= 5) return 'btn-primary';
		if (n >= 3) return 'btn-dark';
		return 'btn-light border-secondary';
	}

	function pfeilColorClass(val: number | null): string {
		if (val === null) return 'pfeil-leer';
		if (val === 0) return 'pfeil-gruen';
		if (val >= 9) return 'pfeil-gelb';
		if (val >= 7) return 'pfeil-rot';
		if (val >= 5) return 'pfeil-blau';
		if (val >= 3) return 'pfeil-schwarz';
		return 'pfeil-weiss';
	}

	function pfeilLabel(val: number | null): string {
		if (val === null) return '–';
		return val === 0 ? 'M' : String(val);
	}

	function onKeypadTap(key: number | string) {
		const ringzahl = key === 'M' ? 0 : (key as number);
		if (korrekturIndex !== null) {
			applyCorrection(korrekturIndex, ringzahl);
		} else {
			handleKey(ringzahl);
		}
	}

	async function handleKey(ringzahl: number) {
		if (sending || confirmingSatzEnde || satz > 5) return;
		const n = gefuellteAnzahl;
		if (n >= 6) return;

		// Optimistisch sofort anzeigen — der Spotter tippt im Takt, ohne auf das
		// Netzwerk zu warten.
		const updated = [...arrows];
		updated[n] = ringzahl;
		arrows = updated;
		if (n === 5) confirmingSatzEnde = true;

		sending = true;
		actionError = null;
		try {
			matchData = await binocularApi.postPfeil(token, scheibennummer, ringzahl);
		} catch (err) {
			// Fehlgeschlagen — optimistische Anzeige zurücknehmen
			const reverted = [...arrows];
			reverted[n] = null;
			arrows = reverted;
			if (n === 5) confirmingSatzEnde = false;

			if (err instanceof APIError && err.status === 423) {
				await handleSatzGesperrt(satz);
			} else {
				const detail = err instanceof APIError ? (err.data as { detail?: string })?.detail : null;
				actionError = detail ?? $_('binocular.pfeil_error');
			}
		} finally {
			sending = false;
		}
	}

	function toggleKorrektur(index: number) {
		if (sending || arrows[index] === null) return;
		korrekturIndex = korrekturIndex === index ? null : index;
	}

	// Korrigiert einen bereits erfassten Pfeil, auch wenn danach schon weitere
	// Pfeile getippt wurden: nimmt alle Pfeile ab (und mit) dem Zielindex zurück
	// (bestehender undo-Endpunkt), setzt den neuen Wert, spielt die dazwischen
	// erfassten Werte danach unverändert wieder ein. Rein auf Basis bestehender
	// Endpunkte — kein Backend-Änderung nötig.
	async function applyCorrection(index: number, ringzahl: number) {
		if (sending) return;
		const totalFilledBefore = gefuellteAnzahl;
		const replayValues = arrows.slice(index + 1, totalFilledBefore) as number[];

		// Optimistisch sofort anzeigen
		const updated = [...arrows];
		updated[index] = ringzahl;
		arrows = updated;
		korrekturIndex = null;

		sending = true;
		actionError = null;
		try {
			const undoCount = totalFilledBefore - index;
			let md: BinocularMatch | undefined;
			for (let i = 0; i < undoCount; i++) {
				md = await binocularApi.postUndo(token, scheibennummer);
			}
			md = await binocularApi.postPfeil(token, scheibennummer, ringzahl);
			for (const v of replayValues) {
				md = await binocularApi.postPfeil(token, scheibennummer, v);
			}
			matchData = md!;
			confirmingSatzEnde = totalFilledBefore === 6;
		} catch (err) {
			if (err instanceof APIError && err.status === 423) {
				await handleSatzGesperrt(satz);
			} else {
				// Bei einem Fehler mitten in der Korrektur-Sequenz ist der lokale Stand
				// nicht mehr zuverlässig — Server-Stand neu laden statt zu raten.
				try {
					const fresh = await binocularApi.getScheibe(token, scheibennummer);
					matchData = fresh;
					arrows = arrowsFromPassen(fresh.vorlaeufige_passen);
					confirmingSatzEnde = arrows.every((v) => v !== null);
				} catch {
					/* Fehleranzeige unten reicht, wenn auch das fehlschlägt */
				}
				const detail = err instanceof APIError ? (err.data as { detail?: string })?.detail : null;
				actionError = detail ?? $_('binocular.korrektur_error');
			}
		} finally {
			sending = false;
		}
	}

	// Schreibt den gerade abgeschlossenen Satz final ans Backend — vorher zählte
	// das hier nur lokal weiter, ohne den Server je zu erreichen. Erst nach Erfolg lokal
	// weiterschalten; die rohe Server-Antwort wird nur zur Erfolgsprüfung genutzt.
	async function bestaetigeSatzEnde() {
		if (satzSaving) return;
		satzSaving = true;
		actionError = null;
		try {
			await binocularApi.postBestaetigeSatz(token, scheibennummer);
			satz += 1;
			arrows = emptyArrows();
			confirmingSatzEnde = false;
		} catch (err) {
			if (err instanceof APIError && err.status === 409) {
				// Der Schütze hat den Satz bereits über den eigenen Schusszettel final
				// bestätigt, während der Spotter noch auf "Weiter zu Satz X" stand — das
				// Ziel (weiter zum nächsten Satz) ist damit ohnehin schon erreicht.
				// handleSatzGesperrt lädt den frischen Stand und schaltet automatisch
				// weiter, statt den Spotter mit einer Fehlermeldung hängen zu lassen.
				await handleSatzGesperrt(satz);
			} else {
				const detail = err instanceof APIError ? (err.data as { detail?: string })?.detail : null;
				actionError = detail ?? $_('binocular.satz_speichern_error');
			}
		} finally {
			satzSaving = false;
		}
	}

	async function handleUndo() {
		if (sending) return;
		korrekturIndex = null;
		sending = true;
		actionError = null;
		try {
			// Undo ist immer autoritativ vom Server — bildet auch den Fall ab, dass
			// über eine Satzgrenze zurückgenommen wird.
			const md = await binocularApi.postUndo(token, scheibennummer);
			matchData = md;
			satz = md.aktueller_satz;
			arrows = arrowsFromPassen(md.vorlaeufige_passen);
			confirmingSatzEnde = false;
		} catch (err) {
			if (err instanceof APIError && err.status === 423) {
				await handleSatzGesperrt(satz);
			} else {
				const detail = err instanceof APIError ? (err.data as { detail?: string })?.detail : null;
				actionError = detail ?? $_('binocular.undo_error');
			}
		} finally {
			sending = false;
		}
	}
</script>

<svelte:head>
	<title>{$_('binocular.page_title')}</title>
</svelte:head>

{#if view === 'LOADING'}
	<div class="d-flex justify-content-center align-items-center min-vh-100">
		<Spinner />
	</div>
{:else if view === 'ERROR'}
	<div class="p-3">
		<Alert color="danger">{loadError}</Alert>
	</div>
{:else if view === 'WARTET'}
	<div class="d-flex flex-column align-items-center justify-content-center min-vh-100 p-3">
		<span class="small text-muted mb-3"
			>{$_('binocular.lane_label', { values: { lane: scheibennummer } })}</span
		>
		<Alert color="warning" class="text-center py-4 w-100 mb-0">
			<i class="bi bi-hourglass-split fs-1 d-block mb-3"></i>
			<h5 class="fw-bold mb-2">{$_('binocular.waiting_title')}</h5>
			<p class="mb-0 small">{$_('binocular.waiting_release_hint')}</p>
		</Alert>
	</div>
{:else if view === 'READY' && matchData}
	<div class="binocular-page">
		<div class="binocular-header border-bottom px-3 py-2">
			<div class="d-flex justify-content-between align-items-center">
				<span class="small text-muted"
					>{$_('binocular.lane_label', { values: { lane: scheibennummer } })}</span
				>
				{#if matchData.status === 'ACTIVE'}
					<span class="small text-muted"
						>{$_('binocular.set_badge', { values: { set: satz } })}</span
					>
				{/if}
			</div>
			<div class="fw-bold text-truncate">{matchData.mannschaft_name}</div>
		</div>

		<div class="binocular-content d-flex flex-column align-items-center justify-content-center">
			{#if matchData.status !== 'ACTIVE'}
				<Alert color="warning" class="text-center py-4 mb-0">
					<i class="bi bi-hourglass-split fs-1 d-block mb-3"></i>
					<h5 class="fw-bold mb-0">
						{matchData.status === 'COMPLETED'
							? $_('binocular.completed_title')
							: $_('binocular.waiting_title')}
					</h5>
				</Alert>
			{:else if satz > 5}
				<p class="text-muted text-center fw-semibold">{$_('binocular.all_sets_done')}</p>
			{:else}
				<!-- Satzweise Anzeige: alle 6 Pfeile des aktuellen Satzes. Bereits erfasste
				     Pfeile sind antippbar, um sie nachträglich zu korrigieren. -->
				<div class="satz-grid">
					{#each [0, 1, 2] as posIdx (posIdx)}
						<div
							class="passe-row {posIdx === aktivePosition &&
							!confirmingSatzEnde &&
							korrekturIndex === null
								? 'passe-aktiv'
								: ''}"
						>
							{#each [posIdx * 2, posIdx * 2 + 1] as idx (idx)}
								<button
									type="button"
									class="pfeil-feld {pfeilColorClass(arrows[idx])} {korrekturIndex === idx
										? 'pfeil-korrektur'
										: ''}"
									disabled={arrows[idx] === null || sending}
									onclick={() => toggleKorrektur(idx)}
								>
									{pfeilLabel(arrows[idx])}
								</button>
							{/each}
						</div>
					{/each}
				</div>

				{#if korrekturIndex !== null}
					<Alert color="info" class="text-center mt-3 mb-0 w-100 py-2">
						{$_('binocular.korrektur_hint', { values: { n: korrekturIndex + 1 } })}
						<button
							type="button"
							class="btn btn-sm btn-link p-0 ms-2"
							onclick={() => (korrekturIndex = null)}
						>
							{$_('binocular.korrektur_cancel')}
						</button>
					</Alert>
				{:else if confirmingSatzEnde}
					<Alert color="success" class="text-center mt-3 mb-0 w-100">
						<div class="fw-bold mb-2">
							{$_('binocular.satz_ende_title', { values: { set: satz } })}
						</div>
						<button
							class="btn btn-success w-100 py-2 fw-bold"
							disabled={satzSaving}
							onclick={bestaetigeSatzEnde}
						>
							{#if satzSaving}
								<Spinner size="sm" class="me-2" />
							{/if}
							{satz < 5
								? $_('binocular.satz_ende_confirm_btn', { values: { next: satz + 1 } })
								: $_('binocular.satz_ende_confirm_final_btn')}
						</button>
					</Alert>
				{/if}
			{/if}
		</div>

		{#if actionError}
			<div class="px-3">
				<Alert color="danger" class="py-2 mb-2">{actionError}</Alert>
			</div>
		{/if}

		{#if matchData.status === 'ACTIVE'}
			<div class="binocular-keypad border-top bg-white p-2">
				{#if korrekturIndex !== null || (!confirmingSatzEnde && satz <= 5)}
					<div class="row g-2 mb-2">
						{#each primaryKeys as row, rowIdx (rowIdx)}
							{#each row as key (key)}
								<div class="col-4">
									<button
										class="btn w-100 keypad-btn-primary {keypadColor(key)}"
										disabled={sending}
										onclick={() => onKeypadTap(key)}
									>
										{key}
									</button>
								</div>
							{/each}
						{/each}
					</div>

					<button
						class="btn btn-outline-secondary w-100 mb-2 toggle-btn"
						onclick={() => (zeigeNiedrigeWerte = !zeigeNiedrigeWerte)}
					>
						{zeigeNiedrigeWerte ? $_('binocular.toggle_hide_low') : $_('binocular.toggle_show_low')}
					</button>

					{#if zeigeNiedrigeWerte}
						<div class="row g-2 mb-2">
							{#each secondaryKeys as key (key)}
								<div class="col">
									<button
										class="btn w-100 keypad-btn-secondary {keypadColor(key)}"
										disabled={sending}
										onclick={() => onKeypadTap(key)}
									>
										{key}
									</button>
								</div>
							{/each}
						</div>
					{/if}
				{/if}

				<button
					class="btn btn-outline-danger w-100 undo-btn"
					disabled={sending}
					onclick={handleUndo}
				>
					{$_('binocular.undo_btn')}
				</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	.binocular-page {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		overflow: hidden;
	}

	.binocular-header {
		flex-shrink: 0;
	}
	.binocular-content {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
	}
	.binocular-keypad {
		flex-shrink: 0;
	}

	.keypad-btn-primary {
		min-height: 84px;
		font-size: 1.85rem;
		font-weight: 700;
	}

	.keypad-btn-secondary {
		min-height: 48px;
		font-size: 1.1rem;
		font-weight: 700;
	}

	.toggle-btn {
		min-height: 44px;
		font-size: 0.9rem;
	}

	.undo-btn {
		min-height: 56px;
		font-size: 1.1rem;
		font-weight: 700;
	}

	/* ── Satzweise Pfeilanzeige ── */
	.satz-grid {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.passe-row {
		display: flex;
		gap: 0.6rem;
		justify-content: center;
		border-radius: 0.75rem;
		padding: 0.25rem;
	}

	.passe-aktiv {
		outline: 3px solid #0d6efd;
		outline-offset: 2px;
	}

	.pfeil-feld {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 4.5rem;
		height: 4.5rem;
		border: 2px solid #dee2e6;
		border-radius: 0.6rem;
		font-weight: 800;
		font-size: 1.75rem;
		padding: 0;
		/* Button-Reset — sieht weiterhin wie ein Anzeigefeld aus, ist aber antippbar */
		cursor: pointer;
	}

	.pfeil-feld:disabled {
		cursor: default;
	}

	/* .pfeil-feld:focus-Variante nötig, da Bootstrap button:focus:not(:focus-visible) {
	   outline: 0; } bei Touch/Maus-Klick höhere Spezifität hat als eine einzelne Klasse
	   und die Markierung sonst sofort beim Antippen wieder verschwinden lässt. */
	.pfeil-korrektur,
	.pfeil-feld.pfeil-korrektur:focus {
		outline: 3px solid #fd7e14;
		outline-offset: 2px;
	}

	.pfeil-leer {
		color: #adb5bd;
		background: #f8f9fa;
	}
	.pfeil-gruen {
		background: #198754;
		color: #fff;
	}
	.pfeil-gelb {
		background: #ffc107;
		color: #000;
	}
	.pfeil-rot {
		background: #dc3545;
		color: #fff;
	}
	.pfeil-blau {
		background: #0d6efd;
		color: #fff;
	}
	.pfeil-schwarz {
		background: #212529;
		color: #fff;
	}
	.pfeil-weiss {
		background: #fff;
		color: #000;
		border-color: #212529;
	}
</style>
