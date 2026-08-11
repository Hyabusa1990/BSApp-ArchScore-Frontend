<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SvelteSet } from 'svelte/reactivity';
	import { auth } from '$lib/stores/auth.svelte';
	import { matchkontrolleApi, type Match } from '$lib/api/matchkontrolle';
	import {
		Container,
		Card,
		CardBody,
		Row,
		Col,
		Badge,
		Alert,
		Spinner
	} from '@sveltestrap/sveltestrap';

	let { data } = $props<{ data: { id: string } }>();
	const veranstaltungId = $derived(data.id);

	let matches = $state<Match[]>([]);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	// Match-IDs, die gerade eine Aktivieren/Deaktivieren-Anfrage laufen haben — verhindert
	// Doppelklicks und zeigt einen kleinen Spinner auf genau der betroffenen Karte.
	const pending = new SvelteSet<string>();

	$effect(() => {
		if (auth.initialized && !auth.isAuthenticated) goto(resolve('/login'));
	});

	async function load() {
		loading = true;
		loadError = null;
		try {
			matches = await matchkontrolleApi.list(auth.accessToken!, veranstaltungId);
		} catch {
			loadError = $_('matchkontrolle.error_load');
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (auth.isAuthenticated) load();
	});

	async function toggle(match: Match) {
		if (pending.has(match.id)) return;
		pending.add(match.id);

		// Optimistisch sofort anzeigen: Aktivieren deaktiviert alle anderen lokal,
		// Deaktivieren nur die eine Karte.
		const wasAktiv = match.aktiv;
		matches = matches.map((m) => ({
			...m,
			aktiv: wasAktiv ? (m.id === match.id ? false : m.aktiv) : m.id === match.id
		}));

		try {
			matches = wasAktiv
				? await matchkontrolleApi.deactivate(auth.accessToken!, veranstaltungId, match.id)
				: await matchkontrolleApi.activate(auth.accessToken!, veranstaltungId, match.id);
		} catch {
			loadError = $_('matchkontrolle.error_toggle');
			await load(); // Optimistischen Stand verwerfen, echten Serverstand nachladen
		} finally {
			pending.delete(match.id);
		}
	}
</script>

<svelte:head>
	<title>{$_('matchkontrolle.title')}</title>
</svelte:head>

<Container class="py-4">
	<a
		href={resolve('/veranstaltungen/[id]', { id: veranstaltungId })}
		class="d-inline-block mb-3 text-decoration-none small"
	>
		&larr; {$_('matchkontrolle.back_btn')}
	</a>

	<h4 class="mb-4">{$_('matchkontrolle.title')}</h4>

	{#if loading}
		<div class="d-flex justify-content-center py-5"><Spinner /></div>
	{:else if loadError}
		<Alert color="danger">{loadError}</Alert>
	{:else if matches.length === 0}
		<p class="text-muted">{$_('matchkontrolle.empty')}</p>
	{:else}
		<Row>
			{#each matches as match (match.id)}
				<Col md={4} sm={6} class="mb-3">
					<Card class="shadow-sm h-100">
						<CardBody class="p-3 text-center d-flex flex-column align-items-center gap-2">
							<div class="fw-bold">
								{$_('matchkontrolle.match_label', { values: { n: match.nummer } })}
							</div>
							<Badge color={match.aktiv ? 'success' : 'warning'} class="px-3 py-2 fs-6">
								{match.aktiv ? $_('matchkontrolle.aktiv') : $_('matchkontrolle.inaktiv')}
							</Badge>
							<button
								type="button"
								class="btn btn-sm {match.aktiv
									? 'btn-link text-warning'
									: 'btn-link text-success'} text-decoration-none"
								disabled={pending.has(match.id)}
								onclick={() => toggle(match)}
							>
								{#if pending.has(match.id)}
									<Spinner size="sm" class="me-1" />
								{/if}
								{match.aktiv
									? $_('matchkontrolle.deactivate_btn')
									: $_('matchkontrolle.activate_btn')}
							</button>
						</CardBody>
					</Card>
				</Col>
			{/each}
		</Row>
	{/if}
</Container>
