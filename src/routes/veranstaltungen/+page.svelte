<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/stores/auth.svelte';
	import { veranstaltungApi, type Veranstaltung } from '$lib/api/veranstaltung';
	import {
		Container,
		Row,
		Col,
		Card,
		CardBody,
		Form,
		Alert,
		Button,
		Spinner,
		Badge
	} from '@sveltestrap/sveltestrap';
	import FormField from '$lib/components/FormField.svelte';

	let veranstaltungen = $state<Veranstaltung[]>([]);
	let loading = $state(true);
	let loadError = $state<string | null>(null);

	// Fixture-Felder (#14) statt eines einzelnen name-Feldes.
	let newLeagueName = $state('');
	let newFixtureName = $state('');
	let newDate = $state('');
	let newLocation = $state('');
	let creating = $state(false);
	let createError = $state<string | null>(null);

	$effect(() => {
		if (auth.initialized && !auth.isAuthenticated) goto(resolve('/login'));
	});

	async function load() {
		loading = true;
		loadError = null;
		try {
			veranstaltungen = await veranstaltungApi.list(auth.accessToken!);
		} catch {
			loadError = $_('veranstaltungen.error_load');
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (auth.isAuthenticated) load();
	});

	function anzeigename(v: Veranstaltung): string {
		return `${v.leagueName} – ${v.fixtureName}`;
	}

	async function handleCreate(e: Event) {
		e.preventDefault();
		if (!newLeagueName.trim() || !newFixtureName.trim() || !newDate || !newLocation.trim()) return;
		creating = true;
		createError = null;
		try {
			const v = await veranstaltungApi.create(auth.accessToken!, {
				leagueName: newLeagueName.trim(),
				fixtureName: newFixtureName.trim(),
				date: new Date(newDate).toISOString(),
				location: newLocation.trim()
			});
			veranstaltungen = [...veranstaltungen, v];
			newLeagueName = '';
			newFixtureName = '';
			newDate = '';
			newLocation = '';
		} catch {
			createError = $_('veranstaltungen.error_create');
		} finally {
			creating = false;
		}
	}

	async function handleDelete(v: Veranstaltung) {
		if (!confirm($_('veranstaltungen.delete_confirm', { values: { name: anzeigename(v) } })))
			return;
		try {
			await veranstaltungApi.remove(auth.accessToken!, v.id);
			veranstaltungen = veranstaltungen.filter((x) => x.id !== v.id);
		} catch {
			loadError = $_('veranstaltungen.error_delete');
		}
	}

	function datenquelleBadge(v: Veranstaltung): { color: string; label: string } {
		if (v.datenquelle === 'tabelle')
			return { color: 'primary', label: $_('veranstaltungen.datenquelle_tabelle') };
		if (v.datenquelle === 'liga')
			return { color: 'success', label: $_('veranstaltungen.datenquelle_liga') };
		return { color: 'secondary', label: $_('veranstaltungen.datenquelle_none') };
	}
</script>

<svelte:head>
	<title>{$_('veranstaltungen.title')}</title>
</svelte:head>

<Container class="py-4">
	<h4 class="mb-4">{$_('veranstaltungen.title')}</h4>

	<Row>
		<Col lg={6} class="mb-4">
			<Card class="shadow-sm">
				<CardBody class="p-4">
					<h6 class="text-muted text-uppercase small fw-semibold mb-3">
						{$_('veranstaltungen.new_title')}
					</h6>
					<Form onsubmit={handleCreate}>
						<FormField
							id="new-league-name"
							label={$_('veranstaltungen.league_name_label')}
							bind:value={newLeagueName}
							placeholder={$_('veranstaltungen.league_name_placeholder')}
							required
							icon="trophy"
						/>
						<FormField
							id="new-fixture-name"
							label={$_('veranstaltungen.fixture_name_label')}
							bind:value={newFixtureName}
							placeholder={$_('veranstaltungen.fixture_name_placeholder')}
							required
							icon="calendar-event"
						/>
						<FormField
							id="new-date"
							label={$_('veranstaltungen.date_label')}
							type="date"
							bind:value={newDate}
							required
							icon="calendar3"
						/>
						<FormField
							id="new-location"
							label={$_('veranstaltungen.location_label')}
							bind:value={newLocation}
							placeholder={$_('veranstaltungen.location_placeholder')}
							required
							icon="geo-alt"
						/>
						{#if createError}
							<Alert color="danger" class="py-2">{createError}</Alert>
						{/if}
						<Button
							type="submit"
							color="primary"
							disabled={creating ||
								!newLeagueName.trim() ||
								!newFixtureName.trim() ||
								!newDate ||
								!newLocation.trim()}
						>
							{#if creating}
								<Spinner size="sm" class="me-2" />
							{/if}
							{$_('veranstaltungen.new_button')}
						</Button>
					</Form>
				</CardBody>
			</Card>
		</Col>
	</Row>

	{#if loading}
		<div class="d-flex justify-content-center py-5"><Spinner /></div>
	{:else if loadError}
		<Alert color="danger">{loadError}</Alert>
	{:else if veranstaltungen.length === 0}
		<p class="text-muted">{$_('veranstaltungen.empty')}</p>
	{:else}
		<Row>
			{#each veranstaltungen as v (v.id)}
				<Col lg={6} class="mb-3">
					<Card class="shadow-sm">
						<CardBody class="p-3 d-flex justify-content-between align-items-center">
							<div>
								<div class="fw-bold">{anzeigename(v)}</div>
								<Badge color={datenquelleBadge(v).color} class="mt-1">
									{datenquelleBadge(v).label}
								</Badge>
							</div>
							<div class="d-flex gap-3">
								<a
									href={resolve('/veranstaltungen/[id]', { id: String(v.id) })}
									class="text-decoration-none"
								>
									{$_('veranstaltungen.open_btn')}
								</a>
								<button
									type="button"
									class="btn btn-link text-danger text-decoration-none p-0"
									onclick={() => handleDelete(v)}
								>
									{$_('veranstaltungen.delete_btn')}
								</button>
							</div>
						</CardBody>
					</Card>
				</Col>
			{/each}
		</Row>
	{/if}
</Container>
