<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ALLOW_REGISTRATION } from '$lib/config';
	import { authApi } from '$lib/api/auth';
	import { Alert, Spinner } from '@sveltestrap/sveltestrap';
	import AuthCard from '$lib/components/AuthCard.svelte';

	let { data } = $props<{ data: { token: string } }>();
	const token = $derived(data.token);

	type ViewState = 'LOADING' | 'SUCCESS' | 'ERROR';
	let view = $state<ViewState>('LOADING');

	$effect(() => {
		if (!ALLOW_REGISTRATION) goto(resolve('/login'));
	});

	// Einmaliger Verify-Call beim Laden — kein Poll, kein Retry (abgelaufener/bereits
	// verbrauchter Token bleibt ungültig, erneutes Aufrufen ändert daran nichts).
	$effect(() => {
		authApi
			.verifyRegistration(token)
			.then(() => (view = 'SUCCESS'))
			.catch(() => (view = 'ERROR'));
	});
</script>

<AuthCard title={$_('register_verify.title')}>
	{#if view === 'LOADING'}
		<div class="d-flex justify-content-center py-3"><Spinner /></div>
	{:else if view === 'SUCCESS'}
		<Alert color="success">{$_('register_verify.success')}</Alert>
	{:else}
		<Alert color="danger">{$_('register_verify.error')}</Alert>
	{/if}
	<p class="text-center text-muted small mt-3 mb-0">
		<a href={resolve('/login')} class="text-decoration-none"
			>{$_('register_verify.back_to_login_btn')}</a
		>
	</p>
</AuthCard>
