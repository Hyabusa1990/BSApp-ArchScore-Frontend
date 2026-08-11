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

	let newName = $state('');
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

	async function handleCreate(e: Event) {
		e.preventDefault();
		if (!newName.trim()) return;
		creating = true;
		createError = null;
		try {
			const v = await veranstaltungApi.create(auth.accessToken!, newName.trim());
			veranstaltungen = [...veranstaltungen, v];
			newName = '';
		} catch {
			createError = $_('veranstaltungen.error_create');
		} finally {
			creating = false;
		}
	}

	async function handleDelete(v: Veranstaltung) {
		if (!confirm($_('veranstaltungen.delete_confirm', { values: { name: v.name } }))) return;
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
							id="new-veranstaltung-name"
							label={$_('veranstaltungen.name_label')}
							bind:value={newName}
							placeholder={$_('veranstaltungen.name_placeholder')}
							required
							icon="calendar-event"
						/>
						{#if createError}
							<Alert color="danger" class="py-2">{createError}</Alert>
						{/if}
						<Button type="submit" color="primary" disabled={creating || !newName.trim()}>
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
								<div class="fw-bold">{v.name}</div>
								<Badge color={datenquelleBadge(v).color} class="mt-1">
									{datenquelleBadge(v).label}
								</Badge>
							</div>
							<div class="d-flex gap-3">
								<a
									href={resolve('/veranstaltungen/[id]', { id: v.id })}
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
