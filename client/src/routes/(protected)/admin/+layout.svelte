<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '$lib/components/basic/Button.svelte';

	const { children } = $props();

	const sideBarItems: { label: string; route: string }[] = [
		{ label: 'Subjects', route: '/admin/subjects' },
		{ label: 'Courses', route: '/admin/courses' },
		{ label: 'Topics', route: '/admin/topics' }
	];
	const directive = 'theme';
</script>

<section>
	<div class="side-bar">
		{#each sideBarItems as item (item.label)}
			<Button onclick={() => goto(item.route)} style="width: 100%;" {directive}>
				{item.label}
			</Button>
		{/each}
	</div>
	{@render children()}
</section>

<style>
	section {
		display: flex;
	}

	.side-bar {
		width: 10rem;
		display: flex;
		padding: var(--gap);
		flex-direction: column;
		gap: var(--gap);
		align-items: end;
		border-right: 1px solid var(--grey);
	}
</style>
