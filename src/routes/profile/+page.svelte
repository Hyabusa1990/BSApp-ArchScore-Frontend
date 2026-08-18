<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/stores/auth.svelte';
	import { authApi } from '$lib/api/auth';
	import { APIError } from '$lib/api/client';
	import {
		Container,
		Row,
		Col,
		Card,
		CardBody,
		Form,
		Alert,
		Button,
		Spinner
	} from '@sveltestrap/sveltestrap';
	import FormField from '$lib/components/FormField.svelte';

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let pwSaving = $state(false);
	let pwSuccess = $state(false);
	let pwErrorKey = $state<string | null>(null);

	$effect(() => {
		if (auth.initialized && !auth.isAuthenticated) goto(resolve('/login'));
	});

	async function changePassword(e: Event) {
		e.preventDefault();
		pwSuccess = false;
		pwErrorKey = null;

		// Confirm-Passwort ist reine Client-Eingabehilfe, geht nicht mit ans Backend (Fawkes-
		// Kontrakt kennt nur currentPassword/newPassword) — gleiches Muster wie register/+page.svelte.
		if (newPassword !== confirmPassword) {
			pwErrorKey = 'profile.error_mismatch';
			return;
		}

		pwSaving = true;
		try {
			await authApi.changePassword(auth.accessToken!, currentPassword, newPassword);
			pwSuccess = true;
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
		} catch (err) {
			pwErrorKey =
				err instanceof APIError && err.status === 401
					? 'profile.error_wrong_password'
					: 'profile.error_failed';
		} finally {
			pwSaving = false;
		}
	}
</script>

<Container class="py-4">
	<h4 class="mb-4">{$_('profile.title')}</h4>
	<Row>
		<Col lg={6} class="mb-4">
			<Card class="h-100 shadow-sm">
				<CardBody class="p-4">
					<h6 class="text-muted text-uppercase small fw-semibold mb-3">
						{$_('profile.section_info')}
					</h6>

					<div class="mb-0">
						<p class="small fw-medium text-secondary mb-1">{$_('profile.email')}</p>
						<p class="mb-0 fw-semibold">{auth.user?.email}</p>
					</div>
				</CardBody>
			</Card>
		</Col>

		<Col lg={6} class="mb-4">
			<Card class="h-100 shadow-sm">
				<CardBody class="p-4">
					<h6 class="text-muted text-uppercase small fw-semibold mb-3">
						{$_('profile.section_password')}
					</h6>
					<Form onsubmit={changePassword}>
						<FormField
							id="current-password"
							label={$_('profile.current_password')}
							type="password"
							bind:value={currentPassword}
							placeholder="••••••••"
							required
							autocomplete="current-password"
							icon="lock"
						/>
						<FormField
							id="new-password"
							label={$_('profile.new_password')}
							type="password"
							bind:value={newPassword}
							placeholder="••••••••"
							required
							autocomplete="new-password"
							icon="lock"
						/>
						<FormField
							id="confirm-password"
							label={$_('profile.confirm_password')}
							type="password"
							bind:value={confirmPassword}
							placeholder="••••••••"
							required
							autocomplete="new-password"
							icon="lock-fill"
						/>
						{#if pwSuccess}
							<Alert color="success" class="py-2">{$_('profile.password_changed')}</Alert>
						{/if}
						{#if pwErrorKey}
							<Alert color="danger" class="py-2">{$_(pwErrorKey)}</Alert>
						{/if}
						<Button type="submit" color="primary" disabled={pwSaving}>
							{#if pwSaving}
								<Spinner size="sm" class="me-2" />{$_('profile.saving')}
							{:else}
								{$_('profile.save')}
							{/if}
						</Button>
					</Form>
				</CardBody>
			</Card>
		</Col>
	</Row>
</Container>
