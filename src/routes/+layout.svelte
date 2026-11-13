<script lang="ts">
	import 'bootstrap/dist/css/bootstrap.min.css';
	import 'bootstrap-icons/font/bootstrap-icons.css';
	import { _, locale } from 'svelte-i18n';
	import { setLocale, languages } from '$lib/i18n';
	import favicon from '$lib/assets/favicon.png';
	import logo from '$lib/assets/logo.png';
	import { auth } from '$lib/stores/auth.svelte';
	import { ALLOW_REGISTRATION } from '$lib/config';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import {
		Navbar,
		NavbarBrand,
		NavbarToggler,
		Nav,
		NavItem,
		NavLink,
		Dropdown,
		DropdownToggle,
		DropdownMenu,
		DropdownItem,
		Icon
	} from '@sveltestrap/sveltestrap';

	let { children } = $props();
	let isNavOpen = $state(false);

	// Chrome-lose Vollbild-Routen (Zuschauer-Bildschirm, Spotter-Tablet, später Kampfrichter) —
	// teilen das Bedürfnis nach unverstellter Fullscreen-Ansicht ohne Site-Navigation, siehe
	// dasselbe Pattern im scoring-Referenzprojekt (dort "isMobileRoute").
	const isChromelessRoute = $derived(
		page.url.pathname.startsWith('/display') ||
			page.url.pathname.startsWith('/tablet') ||
			page.url.pathname.startsWith('/team')
	);

	// Veranstaltungs-Verwaltung ist für jeden eingeloggten Account sichtbar (user verwaltet
	// eigene Veranstaltungen, admin alle) — kein role==="admin"-Gate hier, das Filtern nach
	// Ownership passiert in der API/im Mock, siehe FACHLICHKEIT.md/Issue #6.
	const showVerwaltungLink = $derived(auth.isAuthenticated);

	// `<svelte:body class:...>` wurde nicht ins Bundle übernommen — Klasse daher per Effect setzen.
	$effect(() => {
		document.body.classList.toggle('fawkes-bg', !isChromelessRoute);
		return () => document.body.classList.remove('fawkes-bg');
	});

	onMount(() => {
		auth.init();
	});

	async function logout() {
		isNavOpen = false;
		await auth.logout();
		goto(resolve('/login'));
	}

	function closeNav() {
		isNavOpen = false;
	}
</script>

<svelte:head>
	<link rel="icon" type="image/png" href={favicon} />
</svelte:head>

{#if !isChromelessRoute}
	<Navbar color="white" light expand="md" class="border-bottom px-3 px-md-4">
		<NavbarBrand href="/" class="d-flex align-items-center gap-2">
			<img src={logo} alt="" width="28" height="28" />
			Fawkes
		</NavbarBrand>
		<NavbarToggler onclick={() => (isNavOpen = !isNavOpen)} />
		<div class="collapse navbar-collapse" class:show={isNavOpen}>
			<Nav class="ms-md-auto align-items-md-center gap-md-2 py-2 py-md-0" navbar>
				{#if auth.isAuthenticated}
					<NavItem>
						<Dropdown>
							<DropdownToggle color="outline-secondary" size="sm" caret>
								<Icon name="person-circle" class="me-1" />{auth.user?.email ?? '…'}
							</DropdownToggle>
							<DropdownMenu end>
								<DropdownItem href="/profile" onclick={closeNav}>
									<Icon name="person-gear" class="me-2" />{$_('nav.profile')}
								</DropdownItem>
								{#if showVerwaltungLink}
									<DropdownItem href="/veranstaltungen" onclick={closeNav}>
										<Icon name="calendar-event" class="me-2" />{$_('nav.veranstaltungen')}
									</DropdownItem>
								{/if}
								<li><hr class="dropdown-divider" /></li>
								<DropdownItem onclick={logout}>
									<Icon name="box-arrow-right" class="me-2" />{$_('nav.logout')}
								</DropdownItem>
							</DropdownMenu>
						</Dropdown>
					</NavItem>
				{:else}
					<NavItem>
						<NavLink href="/login" onclick={closeNav}>{$_('nav.login')}</NavLink>
					</NavItem>
					{#if ALLOW_REGISTRATION}
						<NavItem class="mb-1 mb-md-0">
							<NavLink
								href="/register"
								class="btn btn-primary btn-sm text-white w-100 w-md-auto"
								onclick={closeNav}
							>
								{$_('nav.register')}
							</NavLink>
						</NavItem>
					{/if}
				{/if}
				<hr class="d-md-none my-2" />
				<NavItem>
					<Dropdown>
						<DropdownToggle color="outline-secondary" size="sm" caret>
							<Icon name="globe2" class="me-1" />{($locale ?? 'en').toUpperCase().slice(0, 2)}
						</DropdownToggle>
						<DropdownMenu end>
							{#each languages as lang (lang.code)}
								<DropdownItem
									active={$locale === lang.code}
									onclick={() => {
										setLocale(lang.code);
										closeNav();
									}}
								>
									<Icon
										name="check2"
										class="me-2 {$locale === lang.code ? '' : 'invisible'}"
									/>{lang.label}
								</DropdownItem>
							{/each}
						</DropdownMenu>
					</Dropdown>
				</NavItem>
			</Nav>
		</div>
	</Navbar>
{/if}

<main>
	{@render children()}
</main>

<style>
	/* Logo als leicht durchscheinendes Hintergrundbild auf den normalen Seiten (nicht auf
	   Display/Tablet). Fixiert, damit es beim Scrollen stehen bleibt; hinter allem Inhalt. */
	:global(body.fawkes-bg) {
		background: #f8fafc;
	}
	:global(body.fawkes-bg)::before {
		content: '';
		position: fixed;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		background: url('/icon-512.png') center / min(70vmin, 520px) no-repeat;
		opacity: 0.08;
	}
</style>
