<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { auth } from '$lib/stores/auth.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ALLOW_REGISTRATION } from '$lib/config';
	import { Container, Button } from '@sveltestrap/sveltestrap';
	import logo from '$lib/assets/logo.png';

	// auth.isAuthenticated ist synchron (aus localStorage) bekannt, noch bevor dieser
	// Effect läuft — angemeldete Nutzer sehen die Landingpage unten also nie aufblitzen,
	// siehe {#if !auth.isAuthenticated} im Markup.
	$effect(() => {
		if (auth.isAuthenticated) goto(resolve('/veranstaltungen'));
	});
</script>

<svelte:head>
	<title>ArchScore</title>
</svelte:head>

{#if !auth.isAuthenticated}
	<div class="home-page">
		<Container class="text-center">
			<img src={logo} alt="" width="72" height="72" class="mb-3" />
			<h1 class="display-5 mb-2">{$_('home.welcome')}</h1>
			<p class="lead text-muted mb-4">{$_('home.tagline')}</p>
			<div class="d-flex justify-content-center gap-2 flex-wrap">
				<Button color="primary" href={resolve('/login')}>{$_('nav.login')}</Button>
				{#if ALLOW_REGISTRATION}
					<Button color="outline-primary" href={resolve('/register')}>
						{$_('nav.register')}
					</Button>
				{/if}
			</div>
		</Container>
	</div>
{/if}

<style>
	.home-page {
		display: flex;
		align-items: center;
		min-height: calc(100vh - 56px);
		background: #f8fafc;
	}
</style>
