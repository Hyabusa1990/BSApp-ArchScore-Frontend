<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/stores/auth.svelte';
	import {
		veranstaltungApi,
		type Veranstaltung,
		type InitialeTabelleEintrag,
		type LigaVerbindung
	} from '$lib/api/veranstaltung';
	import { Container, Card, CardBody, Alert, Button, Spinner } from '@sveltestrap/sveltestrap';
	import FormField from '$lib/components/FormField.svelte';

	let { data } = $props<{ data: { id: string } }>();
	const id = $derived(data.id);

	let veranstaltung = $state<Veranstaltung | null>(null);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let saveError = $state<string | null>(null);
	let saving = $state(false);

	// null = noch nicht entschieden (Chooser anzeigen). Wird beim Laden aus der bestehenden
	// datenquelle übernommen, kann aber per Sekundär-Link umgeschaltet werden, ohne dass das
	// schon gespeichert wird — erst der jeweilige Submit-Button persistiert.
	let chosenSource = $state<'tabelle' | 'liga' | null>(null);

	type TabelleRow = { mannschaft_name: string; satzpunkte: number; matchpunkte: number };
	let rows = $state<TabelleRow[]>([]);

	let ligaApp = $state('BSApp Liga');
	let ligaUrl = $state('');
	let ligaPin = $state('');
	let digitalerSchusszettel = $state(false);

	$effect(() => {
		if (auth.initialized && !auth.isAuthenticated) goto(resolve('/login'));
	});

	async function load() {
		loading = true;
		loadError = null;
		try {
			veranstaltung = await veranstaltungApi.get(auth.accessToken!, id);
			chosenSource = veranstaltung.datenquelle;
			rows = (veranstaltung.tabelle ?? []).map((e) => ({
				mannschaft_name: e.mannschaft_name,
				satzpunkte: e.satzpunkte,
				matchpunkte: e.matchpunkte
			}));
			if (rows.length === 0) rows = [{ mannschaft_name: '', satzpunkte: 0, matchpunkte: 0 }];
			if (veranstaltung.liga) {
				ligaApp = veranstaltung.liga.liga_app;
				ligaUrl = veranstaltung.liga.url;
				ligaPin = veranstaltung.liga.login_pin;
				digitalerSchusszettel = veranstaltung.liga.digitaler_schusszettel;
			}
		} catch {
			loadError = $_('veranstaltungen.error_load');
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (auth.isAuthenticated) load();
	});

	function addRow() {
		rows = [...rows, { mannschaft_name: '', satzpunkte: 0, matchpunkte: 0 }];
	}

	function removeRow(index: number) {
		if (rows.length <= 1) return;
		rows = rows.filter((_, i) => i !== index);
	}

	async function saveTabelle() {
		saving = true;
		saveError = null;
		try {
			const eintraege: InitialeTabelleEintrag[] = rows
				.filter((r) => r.mannschaft_name.trim())
				.map((r, i) => ({
					platz: i + 1,
					mannschaft_name: r.mannschaft_name.trim(),
					satzpunkte: r.satzpunkte,
					matchpunkte: r.matchpunkte
				}));
			veranstaltung = await veranstaltungApi.setTabelle(auth.accessToken!, id, eintraege);
		} catch {
			saveError = $_('veranstaltungen.error_save');
		} finally {
			saving = false;
		}
	}

	async function deleteTabelle() {
		saving = true;
		saveError = null;
		try {
			veranstaltung = await veranstaltungApi.clearTabelle(auth.accessToken!, id);
			chosenSource = null;
			rows = [{ mannschaft_name: '', satzpunkte: 0, matchpunkte: 0 }];
		} catch {
			saveError = $_('veranstaltungen.error_save');
		} finally {
			saving = false;
		}
	}

	async function connectLiga() {
		saving = true;
		saveError = null;
		try {
			const data: LigaVerbindung = {
				liga_app: ligaApp,
				url: ligaUrl,
				login_pin: ligaPin,
				digitaler_schusszettel: digitalerSchusszettel
			};
			veranstaltung = await veranstaltungApi.connectLiga(auth.accessToken!, id, data);
		} catch {
			saveError = $_('veranstaltungen.error_save');
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>{veranstaltung?.name ?? $_('veranstaltungen.title')}</title>
</svelte:head>

<Container class="py-4">
	<a href={resolve('/veranstaltungen')} class="d-inline-block mb-3 text-decoration-none small">
		&larr; {$_('veranstaltungen.back_btn')}
	</a>

	{#if loading}
		<div class="d-flex justify-content-center py-5"><Spinner /></div>
	{:else if loadError || !veranstaltung}
		<Alert color="danger">{loadError}</Alert>
	{:else}
		<div class="d-flex justify-content-between align-items-center mb-4">
			<h4 class="mb-0">{veranstaltung.name}</h4>
			<div class="d-flex gap-2">
				<a
					href={resolve('/veranstaltungen/[id]/bildschirme', { id })}
					class="btn btn-outline-secondary btn-sm"
				>
					{$_('veranstaltungen.bildschirme_btn')}
				</a>
				{#if veranstaltung.datenquelle !== null}
					<a
						href={resolve('/veranstaltungen/[id]/matchkontrolle', { id })}
						class="btn btn-outline-primary btn-sm"
					>
						{$_('veranstaltungen.matchkontrolle_btn')}
					</a>
				{/if}
			</div>
		</div>

		{#if saveError}
			<Alert color="danger">{saveError}</Alert>
		{/if}

		{#if chosenSource === null}
			<Card class="shadow-sm">
				<CardBody class="p-4 text-center">
					<p class="text-muted mb-3">{$_('veranstaltungen.choose_hint')}</p>
					<div class="d-flex gap-2 justify-content-center">
						<Button color="primary" onclick={() => (chosenSource = 'tabelle')}>
							{$_('veranstaltungen.choose_tabelle_btn')}
						</Button>
						<Button color="outline-primary" onclick={() => (chosenSource = 'liga')}>
							{$_('veranstaltungen.choose_liga_btn')}
						</Button>
					</div>
				</CardBody>
			</Card>
		{:else if chosenSource === 'tabelle'}
			<Card class="shadow-sm">
				<CardBody class="p-4">
					<div class="d-flex justify-content-between align-items-center mb-3">
						<h6 class="text-muted text-uppercase small fw-semibold mb-0">
							{$_('veranstaltungen.tabelle_heading')}
						</h6>
						<button
							type="button"
							class="btn btn-link btn-sm text-decoration-none p-0"
							onclick={() => (chosenSource = 'liga')}
						>
							{$_('veranstaltungen.switch_to_liga')}
						</button>
					</div>

					<div class="table-responsive">
						<table class="table align-middle">
							<thead>
								<tr>
									<th style="width: 3rem;">{$_('veranstaltungen.tabelle_platz')}</th>
									<th>{$_('veranstaltungen.tabelle_mannschaft')}</th>
									<th style="width: 8rem;">{$_('veranstaltungen.tabelle_satzpunkte')}</th>
									<th style="width: 8rem;">{$_('veranstaltungen.tabelle_matchpunkte')}</th>
									<th style="width: 3rem;"></th>
								</tr>
							</thead>
							<tbody>
								{#each rows as row, i (i)}
									<tr>
										<td class="fw-bold text-muted">{i + 1}</td>
										<td>
											<input
												class="form-control form-control-sm"
												bind:value={row.mannschaft_name}
											/>
										</td>
										<td>
											<input
												type="number"
												class="form-control form-control-sm"
												bind:value={row.satzpunkte}
											/>
										</td>
										<td>
											<input
												type="number"
												class="form-control form-control-sm"
												bind:value={row.matchpunkte}
											/>
										</td>
										<td>
											<button
												type="button"
												class="btn btn-sm btn-outline-danger"
												disabled={rows.length <= 1}
												onclick={() => removeRow(i)}
											>
												&times;
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<button type="button" class="btn btn-outline-secondary btn-sm mb-3" onclick={addRow}>
						+ {$_('veranstaltungen.tabelle_add_row')}
					</button>

					<div class="d-flex gap-2">
						<Button color="success" disabled={saving} onclick={saveTabelle}>
							{#if saving}<Spinner size="sm" class="me-2" />{/if}
							{$_('veranstaltungen.tabelle_anlegen_btn')}
						</Button>
						{#if veranstaltung.datenquelle === 'tabelle'}
							<Button color="danger" outline disabled={saving} onclick={deleteTabelle}>
								{$_('veranstaltungen.tabelle_loeschen_btn')}
							</Button>
						{/if}
					</div>
				</CardBody>
			</Card>
		{:else if chosenSource === 'liga'}
			<Card class="shadow-sm">
				<CardBody class="p-4">
					<div class="d-flex justify-content-between align-items-center mb-3">
						<h6 class="text-muted text-uppercase small fw-semibold mb-0">
							{$_('veranstaltungen.liga_heading')}
						</h6>
						<button
							type="button"
							class="btn btn-link btn-sm text-decoration-none p-0"
							onclick={() => (chosenSource = 'tabelle')}
						>
							{$_('veranstaltungen.switch_to_tabelle')}
						</button>
					</div>

					<div class="mb-3">
						<label class="form-label" for="liga-app">{$_('veranstaltungen.liga_app_label')}</label>
						<select id="liga-app" class="form-select" bind:value={ligaApp}>
							<option value="BSApp Liga">BSApp Liga</option>
						</select>
					</div>

					<FormField
						id="liga-url"
						label={$_('veranstaltungen.liga_url_label')}
						bind:value={ligaUrl}
						placeholder="https://liga.bsapp.de"
						icon="link-45deg"
					/>
					<FormField
						id="liga-pin"
						label={$_('veranstaltungen.liga_pin_label')}
						bind:value={ligaPin}
						icon="key"
					/>

					<div class="mb-3">
						<label class="form-label" for="liga-schusszettel">
							{$_('veranstaltungen.liga_schusszettel_label')}
						</label>
						<select
							id="liga-schusszettel"
							class="form-select"
							value={digitalerSchusszettel ? 'ja' : 'nein'}
							onchange={(e) => (digitalerSchusszettel = e.currentTarget.value === 'ja')}
						>
							<option value="ja">{$_('veranstaltungen.liga_ja')}</option>
							<option value="nein">{$_('veranstaltungen.liga_nein')}</option>
						</select>
					</div>

					<Button color="success" disabled={saving} onclick={connectLiga}>
						{#if saving}<Spinner size="sm" class="me-2" />{/if}
						{$_('veranstaltungen.liga_connect_btn')}
					</Button>
				</CardBody>
			</Card>
		{/if}
	{/if}
</Container>
