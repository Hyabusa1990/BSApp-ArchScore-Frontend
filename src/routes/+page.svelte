<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { auth } from '$lib/stores/auth.svelte';
	import { Container } from '@sveltestrap/sveltestrap';
</script>

<div class="home-page">
	<Container class="text-center">
		{#if auth.isAuthenticated}
			<h1 class="display-5 mb-2">
				{$_('home.welcome_user', { values: { username: auth.user?.username } })}
			</h1>
			<p class="lead text-muted">{$_('home.logged_in')}</p>
		{:else}
			<h1 class="display-5 mb-2">{$_('home.welcome')}</h1>
			<p class="lead text-muted">
				{$_('home.login_hint_1')}
				<a href="/login" class="text-decoration-none fw-semibold">{$_('nav.login')}</a>
				{$_('home.login_hint_2')}
			</p>
		{/if}
	</Container>
</div>

<style>
	.home-page {
		display: flex;
		align-items: center;
		min-height: calc(100vh - 56px);
		background: #f8fafc;
	}
</style>