<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { auth } from '$lib/stores/auth.svelte';
	import { ALLOW_REGISTRATION } from '$lib/config';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { APIError } from '$lib/api/client';
	import { Alert, Button, Form, Spinner } from '@sveltestrap/sveltestrap';
	import AuthCard from '$lib/components/AuthCard.svelte';
	import FormField from '$lib/components/FormField.svelte';

	let email = $state('');
	let password = $state('');
	let passwordConfirm = $state('');
	let errorKey = $state<string | null>(null);
	let errorDirect = $state<string | null>(null);
	let success = $state(false);

	$effect(() => {
		if (!ALLOW_REGISTRATION) {
			goto(resolve('/login'));
		}
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		errorKey = null;
		errorDirect = null;

		if (password !== passwordConfirm) {
			errorKey = 'register.error_mismatch';
			return;
		}

		try {
			await auth.register(email, password);
			success = true;
		} catch (err) {
			if (err instanceof APIError) {
				const msg = (err.data as { detail?: string })?.detail;
				if (msg) {
					errorDirect = msg;
				} else {
					errorKey = 'register.error_failed';
				}
			} else {
				errorKey = 'register.error_unexpected';
			}
		}
	}
</script>

<AuthCard title={$_('register.title')}>
	{#if success}
		<Alert color="success">{$_('register.success')}</Alert>
		<p class="text-center text-muted small mt-3 mb-0">
			<a href={resolve('/login')} class="text-decoration-none">{$_('nav.login')}</a>
		</p>
	{:else}
		<Form onsubmit={handleSubmit}>
			<FormField
				id="email"
				label={$_('register.email')}
				type="email"
				bind:value={email}
				placeholder={$_('register.email_placeholder')}
				required
				autocomplete="email"
				icon="envelope"
			/>
			<FormField
				id="password"
				label={$_('register.password')}
				type="password"
				bind:value={password}
				placeholder="••••••••"
				required
				autocomplete="new-password"
				icon="lock"
			/>
			<FormField
				id="password-confirm"
				label={$_('register.password_confirm')}
				type="password"
				bind:value={passwordConfirm}
				placeholder="••••••••"
				required
				autocomplete="new-password"
				icon="lock"
			/>
			{#if errorKey}
				<Alert color="danger" class="py-2 mb-3">{$_(errorKey)}</Alert>
			{:else if errorDirect}
				<Alert color="danger" class="py-2 mb-3">{errorDirect}</Alert>
			{/if}
			<Button type="submit" color="primary" class="w-100 mt-1" disabled={auth.loading}>
				{#if auth.loading}
					<Spinner size="sm" class="me-2" />{$_('register.loading')}
				{:else}
					{$_('register.submit')}
				{/if}
			</Button>
		</Form>
		<p class="text-center text-muted small mt-3 mb-0">
			{$_('register.have_account')}
			<a href={resolve('/login')} class="text-decoration-none">{$_('nav.login')}</a>
		</p>
	{/if}
</AuthCard>
