<script lang="ts">
	import '$lib/styles/colours.css';
	import '$lib/styles/variables.css';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Footer from '$lib/components/navigation/Footer.svelte';
	import Header from '$lib/components/navigation/Header.svelte';
	import type { LayoutData } from './$types';

	let { children, data } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="layout-container">
	<Header user={data.user} />

	<main>
		{@render children()}
	</main>

	<Footer />
</div>

<style>
	.layout-container {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	:global(html, body) {
		margin: 0;
		padding: 0;
		min-height: 100%;
	}

	main {
		display: flex;
		flex-direction: column;
		flex: 1;
	}
</style>
