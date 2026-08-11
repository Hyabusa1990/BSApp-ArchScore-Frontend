<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/stores/auth.svelte';
	import { bildschirmeApi, type Bildschirm } from '$lib/api/bildschirme';
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

	let bildschirme = $state<Bildschirm[]>([]);
	let loading = $state(true);
	let loadError = $state<string | null>(null);

	// Lokaler Bearbeitungsentwurf pro Bildschirm (PIN/Aktiv/Modus) — erst "Speichern"
	// persistiert. Keyed by Bildschirm-ID.
	type Draft = { pin: string; aktiv: boolean; mode: Bildschirm['mode'] };
	let drafts = $state<Record<string, Draft>>({});
	let savingId = $state<string | null>(null);
	let saveError = $state<string | null>(null);

	let newScreenName = $state('');
	let creatingScreen = $state(false);
	let createError = $state<string | null>(null);

	// Keine explizite "Scheiben dieser Veranstaltung"-Liste im Modell (#6) — abgeleitet aus
	// den scheibe_a/scheibe_b-Werten der geladenen Bildschirme.
	const scheiben = $derived(
		[
			...new Set(bildschirme.flatMap((b) => [b.scheibe_a, b.scheibe_b]).filter((n) => n !== null))
		].sort((a, b) => a - b)
	);

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
			bildschirme = await bildschirmeApi.list(auth.accessToken!, veranstaltungId);
			drafts = Object.fromEntries(
				bildschirme.map((b) => [b.id, { pin: b.pin, aktiv: b.aktiv, mode: b.mode }])
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

	async function saveScreen(b: Bildschirm) {
		const draft = drafts[b.id];
		if (!draft) return;
		savingId = b.id;
		saveError = null;
		try {
			const updated = await bildschirmeApi.update(auth.accessToken!, veranstaltungId, b.id, draft);
			bildschirme = bildschirme.map((x) => (x.id === b.id ? updated : x));
			drafts = {
				...drafts,
				[b.id]: { pin: updated.pin, aktiv: updated.aktiv, mode: updated.mode }
			};
		} catch {
			saveError = $_('bildschirme.error_save');
		} finally {
			savingId = null;
		}
	}

	async function addScreen(e: Event) {
		e.preventDefault();
		if (!newScreenName.trim()) return;
		creatingScreen = true;
		createError = null;
		try {
			const b = await bildschirmeApi.create(
				auth.accessToken!,
				veranstaltungId,
				newScreenName.trim()
			);
			bildschirme = [...bildschirme, b];
			drafts = { ...drafts, [b.id]: { pin: b.pin, aktiv: b.aktiv, mode: b.mode } };
			newScreenName = '';
		} catch {
			createError = $_('bildschirme.error_create');
		} finally {
			creatingScreen = false;
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
			{#each bildschirme as b (b.id)}
				{@const draft = drafts[b.id]}
				<Col md={4} sm={6} class="mb-3">
					<Card class="shadow-sm h-100">
						<CardBody class="p-3">
							<div class="d-flex justify-content-between align-items-start mb-2">
								<div class="fw-bold">
									{b.name ??
										$_('bildschirme.scheiben_paar_label', {
											values: { a: b.scheibe_a, b: b.scheibe_b }
										})}
								</div>
								<Badge color={draft?.aktiv ? 'success' : 'warning'}>
									{draft?.aktiv ? $_('bildschirme.aktiv') : $_('bildschirme.inaktiv')}
								</Badge>
							</div>

							{#if draft}
								<div class="mb-2">
									<label class="form-label small mb-1" for="pin-{b.id}">
										{$_('bildschirme.pin_label')}
									</label>
									<input
										id="pin-{b.id}"
										class="form-control form-control-sm"
										bind:value={draft.pin}
									/>
								</div>

								<div class="mb-2">
									<label class="form-label small mb-1" for="mode-{b.id}">
										{$_('bildschirme.mode_label')}
									</label>
									<select
										id="mode-{b.id}"
										class="form-select form-select-sm"
										bind:value={draft.mode}
									>
										<option value="ergebnisse">{$_('bildschirme.mode_ergebnisse')}</option>
										<option value="tabelle">{$_('bildschirme.mode_tabelle')}</option>
									</select>
								</div>

								<div class="form-check form-switch mb-3">
									<input
										class="form-check-input"
										type="checkbox"
										role="switch"
										id="aktiv-{b.id}"
										bind:checked={draft.aktiv}
									/>
									<label class="form-check-label small" for="aktiv-{b.id}">
										{$_('bildschirme.aktiv_toggle_label')}
									</label>
								</div>

								<Button
									size="sm"
									color="success"
									disabled={savingId === b.id}
									onclick={() => saveScreen(b)}
								>
									{#if savingId === b.id}<Spinner size="sm" class="me-2" />{/if}
									{$_('bildschirme.save_btn')}
								</Button>
							{/if}
						</CardBody>
					</Card>
				</Col>
			{/each}

			<Col md={4} sm={6} class="mb-3">
				<Card class="shadow-sm h-100 border-dashed">
					<CardBody class="p-3">
						<h6 class="text-muted text-uppercase small fw-semibold mb-2">
							{$_('bildschirme.add_screen_heading')}
						</h6>
						<form onsubmit={addScreen}>
							<input
								class="form-control form-control-sm mb-2"
								placeholder={$_('bildschirme.add_screen_placeholder')}
								bind:value={newScreenName}
								required
							/>
							{#if createError}
								<Alert color="danger" class="py-1 px-2 small">{createError}</Alert>
							{/if}
							<Button
								size="sm"
								color="primary"
								type="submit"
								disabled={creatingScreen || !newScreenName.trim()}
							>
								{#if creatingScreen}<Spinner size="sm" class="me-2" />{/if}
								{$_('bildschirme.add_screen_btn')}
							</Button>
						</form>
					</CardBody>
				</Card>
			</Col>
		</Row>

		{#if scheiben.length > 0}
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
