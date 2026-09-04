<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/stores/auth.svelte';
	import {
		bildschirmeApi,
		type Device,
		type DisplayType,
		type DisplayTheme
	} from '$lib/api/bildschirme';
	import { veranstaltungApi, type Veranstaltung } from '$lib/api/veranstaltung';
	import { APIError } from '$lib/api/client';
	import QRCode from 'qrcode';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import {
		Container,
		Row,
		Col,
		Card,
		CardHeader,
		CardBody,
		CardFooter,
		Alert,
		Button,
		Spinner,
		Badge,
		Modal,
		ModalHeader,
		ModalBody
	} from '@sveltestrap/sveltestrap';

	let { data } = $props<{ data: { id: string } }>();
	const veranstaltungId = $derived(data.id);
	// `bildschirmeApi` spricht seit #15 direkt die Fawkes-Fixture-ID an — der Routen-Parameter
	// bleibt (wie überall) ein String.
	const fixtureId = $derived(Number(veranstaltungId));

	let devices = $state<Device[]>([]);
	// Nur für `veranstaltung.uniqueId` gebraucht — das Tablet-QR kodiert sie direkt (Issue #22),
	// kein eigener Token-Endpunkt mehr nötig, siehe openTabletModal.
	let veranstaltung = $state<Veranstaltung | null>(null);
	let loading = $state(true);
	let loadError = $state<string | null>(null);

	// Lokaler Bearbeitungsentwurf pro Gerät (displayType/matchNo/displayTheme) — erst "Speichern"
	// persistiert.
	type Draft = { displayType: DisplayType; matchNo: number | null; displayTheme: DisplayTheme };
	let drafts = $state<Record<number, Draft>>({});
	let savingId = $state<number | null>(null);
	let unassignTarget = $state<Device | null>(null);
	let unassigning = $state(false);
	let saveError = $state<string | null>(null);

	let newDeviceCode = $state('');
	let assigning = $state(false);
	let assignError = $state<string | null>(null);

	// Feste Scheiben-Paarung (FACHLICHKEIT.md: 1 gg. 2, 3 gg. 4, 5 gg. 6, 7 gg. 8) — kann seit
	// #15 nicht mehr aus den Geräten abgeleitet werden (kein scheibe_a/scheibe_b im echten
	// DeviceManagement-Modell mehr), Tablet-Pairing bleibt aber weiterhin pro einzelner Scheibe
	// (nicht pro Paar), nur der Pairing-Mechanismus selbst wurde geändert (Issue #22).
	const scheiben = [1, 2, 3, 4, 5, 6, 7, 8];

	// `matchNo` (Fawkes-Feldname) ist bei `displayType === 'Match'` der 1-basierte Index der
	// Begegnung innerhalb der aktuell freigegebenen Runde, NICHT die Match-/Rundennummer —
	// klargestellt 2026-09-04 (Gero), siehe ausführlicher Kommentar in `mocks/displays.ts`.
	// Reihenfolge deckungsgleich mit den `begegnungen`-Arrays in `mocks/veranstaltungen.ts`.
	const begegnungScheiben: Record<number, string> = { 1: '1/2', 2: '3/4', 3: '5/6', 4: '7/8' };

	// Backend kennt `matchNo` nur bei `displayType === 'Match'` (Fawkes-Validierung) — beim
	// Umschalten auf LeagueTable/None wird es serverseitig auf `null` gesetzt und geht damit für
	// den Draft verloren. Wunsch Gero (2026-09-04): in Spielpausen viele Displays kurz auf
	// Tabelle stellen, danach zum nächsten Match wieder auf dieselbe Begegnung zurück, ohne sie
	// sich merken zu müssen — rein client-seitiger Cache (localStorage, pro Fixture+Gerät,
	// überlebt auch einen Reload) füllt `matchNo` beim Zurückschalten auf Match automatisch
	// wieder ein. Reine Usability-Krücke, kein Server-Zustand.
	function lastMatchNoKey(deviceId: number): string {
		return `bildschirme:${fixtureId}:${deviceId}:lastMatchNo`;
	}

	function rememberMatchNo(deviceId: number, matchNo: number) {
		try {
			localStorage.setItem(lastMatchNoKey(deviceId), String(matchNo));
		} catch {
			// z. B. privater Modus ohne Storage-Zugriff — Cache ist dann einfach leer, kein Problem.
		}
	}

	function recallMatchNo(deviceId: number): number | null {
		try {
			const raw = localStorage.getItem(lastMatchNoKey(deviceId));
			return raw ? Number(raw) : null;
		} catch {
			return null;
		}
	}

	/** Beim Zurückschalten auf "Match" die zuletzt gewählte Begegnung vorbelegen, falls noch
	 * keine gesetzt ist (frischer Draft, `matchNo` kommt gerade erst von `null`). */
	function restoreLastMatchNo(deviceId: number) {
		const draft = drafts[deviceId];
		if (!draft || draft.matchNo !== null) return;
		const cached = recallMatchNo(deviceId);
		if (cached !== null) draft.matchNo = cached;
	}

	/** Aus displayType/matchNo hergeleiteter Funktionsname ("Match - 1/2", "Tabelle", "Aus") —
	 * Wunsch Gero (2026-09-04): Kartenname soll zeigen, WOFÜR ein Gerät gerade steht, nicht nur
	 * seine ID. Ignoriert einen evtl. gesetzten eigenen Namen bewusst (dient auch als Vorschau-
	 * Platzhalter im Namensfeld, siehe Template). */
	function autoDeviceName(draft: Draft | undefined, deviceId: number): string {
		if (!draft) return $_('bildschirme.device_label', { values: { id: deviceId } });
		if (draft.displayType === 'Match') {
			const scheiben = draft.matchNo !== null ? begegnungScheiben[draft.matchNo] : undefined;
			return scheiben
				? $_('bildschirme.name_match', { values: { scheiben } })
				: $_('bildschirme.mode_match');
		}
		if (draft.displayType === 'LeagueTable') return $_('bildschirme.name_league_table');
		return $_('bildschirme.mode_none');
	}

	/** Eigener Name hat Vorrang vor dem Funktionsnamen, sonst Fallback auf `autoDeviceName`. */
	function deviceDisplayName(deviceId: number, draft: Draft | undefined): string {
		const custom = customNames[deviceId]?.trim();
		return custom ? custom : autoDeviceName(draft, deviceId);
	}

	// Eigener Anzeigename (Wunsch Gero, 2026-09-04) ist bewusst rein clientseitig — kein Fawkes-
	// Feld dafür (siehe api/bildschirme.ts), reine Admin-UI-Usability. Gleicher Cache-Ansatz wie
	// `lastMatchNo` oben: localStorage pro Fixture+Gerät, überlebt einen Reload.
	let customNames = $state<Record<number, string>>({});
	let editingNameId = $state<number | null>(null);
	let nameDraft = $state('');
	let nameInputEl = $state<HTMLInputElement | null>(null);

	function customNameKey(deviceId: number): string {
		return `bildschirme:${fixtureId}:${deviceId}:customName`;
	}

	function recallCustomName(deviceId: number): string {
		try {
			return localStorage.getItem(customNameKey(deviceId)) ?? '';
		} catch {
			return '';
		}
	}

	function startEditName(deviceId: number) {
		editingNameId = deviceId;
		nameDraft = customNames[deviceId] ?? '';
	}

	function commitName(deviceId: number) {
		if (editingNameId !== deviceId) return; // per Escape schon abgebrochen, siehe onNameKeydown
		const trimmed = nameDraft.trim();
		try {
			if (trimmed) localStorage.setItem(customNameKey(deviceId), trimmed);
			else localStorage.removeItem(customNameKey(deviceId));
		} catch {
			// z. B. privater Modus ohne Storage-Zugriff — Anzeige übernimmt den Wert trotzdem für
			// den Rest der Session, geht nur beim Reload verloren.
		}
		customNames = { ...customNames, [deviceId]: trimmed };
		editingNameId = null;
	}

	function onNameKeydown(e: KeyboardEvent, deviceId: number) {
		if (e.key === 'Enter') {
			e.preventDefault();
			commitName(deviceId);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			editingNameId = null; // Abbrechen, nameDraft wird verworfen
		}
	}

	function onNameBlur(deviceId: number) {
		// Nur noch aktiv, wenn nicht schon per Enter/Escape beendet (siehe onNameKeydown) — sonst
		// würde ein durchs Ausblenden ausgelöster Blur den bereits verworfenen Draft erneut greifen.
		if (editingNameId === deviceId) commitName(deviceId);
	}

	$effect(() => {
		if (editingNameId !== null) nameInputEl?.focus();
	});

	let qrModalOpen = $state(false);
	let qrLoading = $state(false);
	let qrError = $state<string | null>(null);
	let qrDataUrl = $state<string | null>(null);
	let qrScheibennummer = $state<number | null>(null);

	$effect(() => {
		if (auth.initialized && !auth.isAuthenticated) goto(resolve('/login'));
	});

	async function load() {
		loading = true;
		loadError = null;
		try {
			[veranstaltung, devices] = await Promise.all([
				veranstaltungApi.get(auth.accessToken!, fixtureId),
				bildschirmeApi.list(auth.accessToken!, fixtureId)
			]);
			drafts = Object.fromEntries(
				devices.map((d) => [
					d.id,
					{ displayType: d.displayType, matchNo: d.matchNo, displayTheme: d.displayTheme }
				])
			);
			// Cache mit dem serverseitig bekannten Stand warmhalten, auch ohne dass der Admin die
			// Begegnung in dieser Session schon mal angefasst hat (siehe restoreLastMatchNo oben).
			for (const d of devices) {
				if (d.matchNo !== null) rememberMatchNo(d.id, d.matchNo);
			}
			customNames = Object.fromEntries(devices.map((d) => [d.id, recallCustomName(d.id)]));
		} catch {
			loadError = $_('bildschirme.error_load');
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (auth.isAuthenticated) load();
	});

	async function saveDevice(d: Device) {
		const draft = drafts[d.id];
		if (!draft) return;
		savingId = d.id;
		saveError = null;
		try {
			const updated = await bildschirmeApi.update(auth.accessToken!, fixtureId, d.id, {
				displayType: draft.displayType,
				matchNo: draft.displayType === 'Match' ? draft.matchNo : null,
				displayTheme: draft.displayTheme
			});
			devices = devices.map((x) => (x.id === d.id ? updated : x));
			drafts = {
				...drafts,
				[d.id]: {
					displayType: updated.displayType,
					matchNo: updated.matchNo,
					displayTheme: updated.displayTheme
				}
			};
		} catch {
			saveError = $_('bildschirme.error_save');
		} finally {
			savingId = null;
		}
	}

	async function confirmUnassign() {
		if (!unassignTarget) return;
		unassigning = true;
		saveError = null;
		try {
			await bildschirmeApi.unassign(auth.accessToken!, fixtureId, unassignTarget.id);
			devices = devices.filter((x) => x.id !== unassignTarget!.id);
			unassignTarget = null;
		} catch {
			saveError = $_('bildschirme.error_unassign');
		} finally {
			unassigning = false;
		}
	}

	async function assignDevice(e: Event) {
		e.preventDefault();
		if (!newDeviceCode.trim()) return;
		assigning = true;
		assignError = null;
		try {
			const d = await bildschirmeApi.assign(auth.accessToken!, fixtureId, newDeviceCode.trim());
			devices = [...devices, d];
			drafts = {
				...drafts,
				[d.id]: { displayType: d.displayType, matchNo: d.matchNo, displayTheme: d.displayTheme }
			};
			customNames = { ...customNames, [d.id]: recallCustomName(d.id) };
			newDeviceCode = '';
		} catch (err) {
			assignError =
				err instanceof APIError && err.status === 404
					? $_('bildschirme.error_unknown_code')
					: $_('bildschirme.error_assign');
		} finally {
			assigning = false;
		}
	}

	// Kein Token-Request mehr nötig (Issue #22) — das QR kodiert direkt die `fixtureUniqueId` der
	// Veranstaltung + Scheibennummer, genau das, was der Bearer-freie Spotter-Endpunkt laut
	// Fawkes-Spec ohnehin schon erwartet (siehe binocular.ts).
	async function openTabletModal(scheibennummer: number) {
		qrScheibennummer = scheibennummer;
		qrModalOpen = true;
		qrLoading = true;
		qrError = null;
		qrDataUrl = null;
		try {
			if (!veranstaltung) throw new Error('Veranstaltung noch nicht geladen');
			const url = `${window.location.origin}${resolve(
				'/tablet/[fixtureUniqueId]/[scheibennummer]',
				{
					fixtureUniqueId: veranstaltung.uniqueId,
					scheibennummer: String(scheibennummer)
				}
			)}`;
			qrDataUrl = await QRCode.toDataURL(url, { width: 280, margin: 1 });
		} catch {
			qrError = $_('bildschirme.qr_error');
		} finally {
			qrLoading = false;
		}
	}
</script>

<svelte:head>
	<title>{$_('bildschirme.title')}</title>
</svelte:head>

<Container class="py-4">
	<a
		href={resolve('/veranstaltungen/[id]', { id: veranstaltungId })}
		class="d-inline-block mb-3 text-decoration-none small"
	>
		&larr; {$_('bildschirme.back_btn')}
	</a>

	<h4 class="mb-4">{$_('bildschirme.title')}</h4>

	{#if loading}
		<div class="d-flex justify-content-center py-5"><Spinner /></div>
	{:else if loadError}
		<Alert color="danger">{loadError}</Alert>
	{:else}
		{#if saveError}
			<Alert color="danger">{saveError}</Alert>
		{/if}

		<h6 class="text-muted text-uppercase small fw-semibold mb-3">
			{$_('bildschirme.screens_heading')}
		</h6>
		<Row>
			{#each devices as d (d.id)}
				{@const draft = drafts[d.id]}
				<Col md={4} sm={6} class="mb-3">
					<Card class="shadow-sm h-100">
						<CardHeader class="d-flex justify-content-between align-items-center">
							<div class="fw-bold flex-grow-1 me-2" style="min-width: 0;">
								{#if editingNameId === d.id}
									<input
										bind:this={nameInputEl}
										type="text"
										class="form-control form-control-sm"
										placeholder={autoDeviceName(draft, d.id)}
										bind:value={nameDraft}
										onkeydown={(e) => onNameKeydown(e, d.id)}
										onblur={() => onNameBlur(d.id)}
									/>
								{:else}
									<span class="d-inline-flex align-items-center gap-1 w-100">
										<span class="text-truncate">{deviceDisplayName(d.id, draft)}</span>
										<button
											type="button"
											class="btn btn-sm btn-link p-0 text-muted flex-shrink-0"
											aria-label={$_('bildschirme.rename_btn')}
											onclick={() => startEditName(d.id)}
										>
											<i class="bi bi-pencil-fill"></i>
										</button>
									</span>
								{/if}
							</div>
							<Badge color="secondary" class="flex-shrink-0">
								{$_('bildschirme.device_label', { values: { id: d.id } })}
							</Badge>
						</CardHeader>
						<CardBody class="p-3">
							{#if draft}
								<div class="mb-2">
									<div class="form-label small mb-1">
										{$_('bildschirme.display_type_label')}
									</div>
									<div
										class="btn-group w-100"
										role="group"
										aria-label={$_('bildschirme.display_type_label')}
									>
										<input
											type="radio"
											class="btn-check"
											name="display-type-{d.id}"
											id="display-type-{d.id}-none"
											autocomplete="off"
											bind:group={draft.displayType}
											value="None"
										/>
										<label
											class="btn btn-sm btn-outline-secondary flex-fill"
											for="display-type-{d.id}-none"
										>
											<i class="bi bi-eye-slash"></i>
											{$_('bildschirme.mode_none')}
										</label>

										<input
											type="radio"
											class="btn-check"
											name="display-type-{d.id}"
											id="display-type-{d.id}-match"
											autocomplete="off"
											bind:group={draft.displayType}
											value="Match"
											onchange={() => restoreLastMatchNo(d.id)}
										/>
										<label
											class="btn btn-sm btn-outline-success flex-fill"
											for="display-type-{d.id}-match"
										>
											<i class="bi bi-people-fill"></i>
											{$_('bildschirme.mode_match')}
										</label>

										<input
											type="radio"
											class="btn-check"
											name="display-type-{d.id}"
											id="display-type-{d.id}-league"
											autocomplete="off"
											bind:group={draft.displayType}
											value="LeagueTable"
										/>
										<label
											class="btn btn-sm btn-outline-info flex-fill"
											for="display-type-{d.id}-league"
										>
											<i class="bi bi-table"></i>
											{$_('bildschirme.mode_league_table')}
										</label>
									</div>
								</div>

								<div class="mb-2">
									<div class="form-label small mb-1">
										{$_('bildschirme.display_theme_label')}
									</div>
									<div
										class="btn-group w-100"
										role="group"
										aria-label={$_('bildschirme.display_theme_label')}
									>
										<input
											type="radio"
											class="btn-check"
											name="display-theme-{d.id}"
											id="display-theme-{d.id}-dark"
											autocomplete="off"
											bind:group={draft.displayTheme}
											value="Dark"
										/>
										<label
											class="btn btn-sm btn-outline-dark flex-fill"
											for="display-theme-{d.id}-dark"
										>
											<i class="bi bi-moon-stars-fill"></i>
											{$_('bildschirme.theme_dark')}
										</label>

										<input
											type="radio"
											class="btn-check"
											name="display-theme-{d.id}"
											id="display-theme-{d.id}-light"
											autocomplete="off"
											bind:group={draft.displayTheme}
											value="Light"
										/>
										<label
											class="btn btn-sm btn-outline-warning flex-fill"
											for="display-theme-{d.id}-light"
										>
											<i class="bi bi-sun-fill"></i>
											{$_('bildschirme.theme_light')}
										</label>
									</div>
								</div>

								{#if draft.displayType === 'Match'}
									<div class="mb-3">
										<div class="form-label small mb-1">
											{$_('bildschirme.match_no_label')}
										</div>
										<div
											class="btn-group w-100"
											role="group"
											aria-label={$_('bildschirme.match_no_label')}
										>
											{#each [1, 2, 3, 4] as n (n)}
												<input
													type="radio"
													class="btn-check"
													name="match-no-{d.id}"
													id="match-no-{d.id}-{n}"
													autocomplete="off"
													bind:group={draft.matchNo}
													value={n}
													onchange={() => rememberMatchNo(d.id, n)}
												/>
												<label
													class="btn btn-sm btn-outline-primary flex-fill"
													for="match-no-{d.id}-{n}"
												>
													{begegnungScheiben[n]}
												</label>
											{/each}
										</div>
									</div>
								{/if}
							{/if}
						</CardBody>
						{#if draft}
							<CardFooter>
								<Row class="g-2">
									<Col xs={8}>
										<Button
											size="sm"
											color="success"
											class="w-100"
											disabled={savingId === d.id}
											onclick={() => saveDevice(d)}
										>
											{#if savingId === d.id}<Spinner size="sm" class="me-2" />{/if}
											{$_('bildschirme.save_btn')}
										</Button>
									</Col>
									<Col xs={4}>
										<Button
											size="sm"
											color="outline-danger"
											class="w-100"
											onclick={() => (unassignTarget = d)}
										>
											{$_('bildschirme.unassign_btn')}
										</Button>
									</Col>
								</Row>
							</CardFooter>
						{/if}
					</Card>
				</Col>
			{/each}

			<Col md={4} sm={6} class="mb-3">
				<Card class="shadow-sm h-100 border-dashed">
					<CardBody class="p-3">
						<h6 class="text-muted text-uppercase small fw-semibold mb-2">
							{$_('bildschirme.assign_heading')}
						</h6>
						<form onsubmit={assignDevice}>
							<input
								class="form-control form-control-sm mb-2"
								placeholder={$_('bildschirme.device_code_placeholder')}
								bind:value={newDeviceCode}
								required
							/>
							{#if assignError}
								<Alert color="danger" class="py-1 px-2 small">{assignError}</Alert>
							{/if}
							<Button
								size="sm"
								color="primary"
								type="submit"
								disabled={assigning || !newDeviceCode.trim()}
							>
								{#if assigning}<Spinner size="sm" class="me-2" />{/if}
								{$_('bildschirme.assign_btn')}
							</Button>
						</form>
					</CardBody>
				</Card>
			</Col>
		</Row>

		<h6 class="text-muted text-uppercase small fw-semibold mb-3 mt-4">
			{$_('bildschirme.tablets_heading')}
		</h6>
		<div class="d-flex flex-wrap gap-2">
			{#each scheiben as nummer (nummer)}
				<Button color="dark" size="sm" onclick={() => openTabletModal(nummer)}>
					{$_('bildschirme.tablet_scheibe_btn', { values: { n: nummer } })}
				</Button>
			{/each}
		</div>
	{/if}
</Container>

<Modal isOpen={qrModalOpen} toggle={() => (qrModalOpen = false)}>
	<ModalHeader toggle={() => (qrModalOpen = false)}>
		{$_('bildschirme.qr_title', { values: { n: qrScheibennummer } })}
	</ModalHeader>
	<ModalBody class="text-center">
		{#if qrLoading}
			<Spinner />
		{:else if qrError}
			<Alert color="danger">{qrError}</Alert>
		{:else if qrDataUrl}
			<img src={qrDataUrl} alt={$_('bildschirme.qr_title', { values: { n: qrScheibennummer } })} />
			<p class="text-muted small mt-2 mb-0">{$_('bildschirme.qr_hint')}</p>
		{/if}
	</ModalBody>
</Modal>

<ConfirmModal
	isOpen={unassignTarget !== null}
	title={$_('bildschirme.unassign_confirm_title')}
	message={unassignTarget
		? $_('bildschirme.unassign_confirm', { values: { id: unassignTarget.id } })
		: ''}
	confirmLabel={$_('bildschirme.unassign_btn')}
	cancelLabel={$_('bildschirme.cancel_btn')}
	confirmColor="danger"
	loading={unassigning}
	onConfirm={confirmUnassign}
	onCancel={() => (unassignTarget = null)}
/>

<style>
	:global(.border-dashed) {
		border-style: dashed !important;
	}
</style>
