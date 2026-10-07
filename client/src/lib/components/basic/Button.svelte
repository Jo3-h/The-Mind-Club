<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		colour?: 'orange' | 'blue' | 'white';
	}

	const { children, colour = 'white', ...restProps }: Props = $props();
	const isBlue = $derived(colour === 'blue');
	const isOrange = $derived(colour === 'orange');
</script>

<button class="button" class:blue={isBlue} class:orange={isOrange} {...restProps}>
	{@render children?.()}
</button>

<style>
	.button {
		border-radius: var(--border-small, 10px);
		padding-inline: calc(2 * var(--gap));
		padding-block: calc(var(--gap) / 2);
		cursor: pointer;
		font-weight: bold;
		box-shadow:
			0 6px 14px rgb(0 0 0 / 0.12),
			0 2px 4px rgb(0 0 0 / 0.08);
		transition:
			transform 120ms ease,
			box-shadow 120ms ease;

		&.blue {
			color: var(--darkest-blue);
			border: 1px solid var(--light-blue);
			background: var(--lightest-blue);
		}

		&.orange {
			color: white;
			border: 1px solid var(--dark-orange);
			background: var(--light-orange);
		}
	}

	.button:hover {
		transform: translateY(1px) scale(0.99, 0.97);
		box-shadow:
			0 3px 8px rgb(0 0 0 / 0.12),
			0 1px 2px rgb(0 0 0 / 0.08);
	}

	.button:active {
		transform: translateY(2px) scale(0.985, 0.95);
		box-shadow:
			0 1px 3px rgb(0 0 0 / 0.14) inset,
			0 1px 2px rgb(0 0 0 / 0.08);
	}
</style>
