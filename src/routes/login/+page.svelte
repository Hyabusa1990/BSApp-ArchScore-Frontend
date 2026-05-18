<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { auth } from '$lib/stores/auth.svelte';
	import { appConfig } from '$lib/stores/config.svelte';
	import { goto } from '$app/navigation';
	import { APIError } from '$lib/api/client';
	import { Alert, Button, Form, Spinner } from '@sveltestrap/sveltestrap';
	import AuthCard from '$lib/components/AuthCard.svelte';
	import FormField from '$lib/components/FormField.svelte';

	let username = $state('');
	let password = $state('');
	let errorKey = $state<string | null>(null);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		errorKey = null;
		try {
			await auth.login(username, password);
			goto('/');
		} catch (err) {
			errorKey =
				err instanceof APIError && err.status === 401
					? 'login.error_invalid'
					: err instanceof APIError
						? 'login.error_failed'
						: 'login.error_unexpected';
		}
	}
</script>

<AuthCard title={$_('login.title')}>
	<Form onsubmit={handleSubmit}>
		<FormField
			id="username"
			label={$_('login.username')}
			bind:value={username}
			placeholder={$_('login.username_placeholder')}
			required
			autocomplete="username"
			icon="person"
		/>
		<FormField
			id="password"
			label={$_('login.password')}
			type="password"
			bind:value={password}
			placeholder="••••••••"
			required
			autocomplete="current-password"
			icon="lock"
		/>
		{#if errorKey}
			<Alert color="danger" class="py-2 mb-3">{$_(errorKey)}</Alert>
		{/if}
		<Button type="submit" color="primary" class="w-100 mt-1" disabled={auth.loading}>
			{#if auth.loading}
				<Spinner size="sm" class="me-2" />{$_('login.loading')}
			{:else}
				{$_('login.submit')}
			{/if}
		</Button>
	</Form>
	{#if appConfig.allowRegistration}
		<p class="text-center text-muted small mt-3 mb-0">
			{$_('login.no_account')}
			<a href="/register" class="text-decoration-none">{$_('nav.register')}</a>
		</p>
	{/if}
</AuthCard>