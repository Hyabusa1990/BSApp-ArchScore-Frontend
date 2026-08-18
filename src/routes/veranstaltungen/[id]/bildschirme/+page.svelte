<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/stores/auth.svelte';
	import { bildschirmeApi, type Device, type DisplayType } from '$lib/api/bildschirme';
	import { APIError } from '$lib/api/client';
	import QRCode from 'qrcode';
	import {
		Container,
		Row,
		Col,
		Card,
		CardBody,
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
	let loading = $state(true);
	let loadError = $state<string | null>(null);

	// Lokaler Bearbeitungsentwurf pro Gerät (displayType/matchNo) — erst "Speichern" persistiert.
	type Draft = { displayType: DisplayType; matchNo: number | null };
	let drafts = $state<Record<number, Draft>>({});
	let savingId = $state<number | null>(null);
	let unassigningId = $state<number | null>(null);
	let saveError = $state<string | null>(null);

	let newDeviceCode = $state('');
	let assigning = $state(false);
	let assignError = $state<string | null>(null);

	// Feste Scheiben-Paarung (FACHLICHKEIT.md: 1 gg. 2, 3 gg. 4, 5 gg. 6, 7 gg. 8) — kann seit
	// #15 nicht mehr aus den Geräten abgeleitet werden (kein scheibe_a/scheibe_b im echten
	// DeviceManagement-Modell mehr), Tablet-Pairing bleibt aber unverändert pro Scheibe.
	const scheiben = [1, 2, 3, 4, 5, 6, 7, 8];

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
			devices = await bildschirmeApi.list(auth.accessToken!, fixtureId);
			drafts = Object.fromEntries(
				devices.map((d) => [d.id, { displayType: d.displayType, matchNo: d.matchNo }])
			);
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
				matchNo: draft.displayType === 'Match' ? draft.matchNo : null
			});
			devices = devices.map((x) => (x.id === d.id ? updated : x));
			drafts = {
				...drafts,
				[d.id]: { displayType: updated.displayType, matchNo: updated.matchNo }
			};
		} catch {
			saveError = $_('bildschirme.error_save');
		} finally {
			savingId = null;
		}
	}

	async function unassign(d: Device) {
		if (unassigningId) return;
		unassigningId = d.id;
		saveError = null;
		try {
			await bildschirmeApi.unassign(auth.accessToken!, fixtureId, d.id);
			devices = devices.filter((x) => x.id !== d.id);
		} catch {
			saveError = $_('bildschirme.error_unassign');
		} finally {
			unassigningId = null;
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
			drafts = { ...drafts, [d.id]: { displayType: d.displayType, matchNo: d.matchNo } };
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

	// Token wird erst beim Klick generiert (nicht vorab für alle Scheiben) — vermeidet
	// unnötige Requests für Scheiben, deren QR-Code nie geöffnet wird.
	async function openTabletModal(scheibennummer: number) {
		qrScheibennummer = scheibennummer;
		qrModalOpen = true;
		qrLoading = true;
		qrError = null;
		qrDataUrl = null;
		try {
			const pairing = await bildschirmeApi.generateTabletToken(
				auth.accessToken!,
				veranstaltungId,
				scheibennummer
			);
			const url = `${window.location.origin}${resolve('/tablet/[token]/[scheibennummer]', {
				token: pairing.token,
				scheibennummer: String(pairing.scheibennummer)
			})}`;
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
						<CardBody class="p-3">
							<div class="d-flex justify-content-between align-items-start mb-2">
								<div class="fw-bold">
									{$_('bildschirme.device_label', { values: { id: d.id } })}
								</div>
								<Badge
									color={draft?.displayType === 'Match'
										? 'success'
										: draft?.displayType === 'LigaTable'
											? 'info'
											: 'secondary'}
								>
									{draft?.displayType === 'Match'
										? $_('bildschirme.mode_match')
										: draft?.displayType === 'LigaTable'
											? $_('bildschirme.mode_liga_table')
											: $_('bildschirme.mode_none')}
								</Badge>
							</div>

							{#if draft}
								<div class="mb-2">
									<label class="form-label small mb-1" for="display-type-{d.id}">
										{$_('bildschirme.display_type_label')}
									</label>
									<select
										id="display-type-{d.id}"
										class="form-select form-select-sm"
										bind:value={draft.displayType}
									>
										<option value="None">{$_('bildschirme.mode_none')}</option>
										<option value="Match">{$_('bildschirme.mode_match')}</option>
										<option value="LigaTable">{$_('bildschirme.mode_liga_table')}</option>
									</select>
								</div>

								{#if draft.displayType === 'Match'}
									<div class="mb-3">
										<label class="form-label small mb-1" for="match-no-{d.id}">
											{$_('bildschirme.match_no_label')}
										</label>
										<input
											id="match-no-{d.id}"
											type="number"
											min="1"
											class="form-control form-control-sm"
											value={draft.matchNo ?? ''}
											oninput={(e) =>
												(draft.matchNo = e.currentTarget.value
													? Number(e.currentTarget.value)
													: null)}
										/>
									</div>
								{/if}

								<div class="d-flex gap-2">
									<Button
										size="sm"
										color="success"
										disabled={savingId === d.id}
										onclick={() => saveDevice(d)}
									>
										{#if savingId === d.id}<Spinner size="sm" class="me-2" />{/if}
										{$_('bildschirme.save_btn')}
									</Button>
									<Button
										size="sm"
										color="outline-danger"
										disabled={unassigningId === d.id}
										onclick={() => unassign(d)}
									>
										{#if unassigningId === d.id}<Spinner size="sm" class="me-2" />{/if}
										{$_('bildschirme.unassign_btn')}
									</Button>
								</div>
							{/if}
						</CardBody>
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

<style>
	:global(.border-dashed) {
		border-style: dashed !important;
	}
</style>
