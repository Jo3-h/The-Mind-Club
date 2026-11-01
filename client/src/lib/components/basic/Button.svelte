<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		colour?: 'orange' | 'blue' | 'white';
		directive?: 'primary' | 'secondary' | 'theme';
	}

	const { children, colour = 'white', directive = 'secondary', ...restProps }: Props = $props();
	const isBlue = $derived(colour === 'blue');
	const isOrange = $derived(colour === 'orange');
</script>

<button
	class="button"
	class:blue={isBlue}
	class:orange={isOrange}
	class:primary={directive === 'primary'}
	class:secondary={directive === 'secondary'}
	class:theme={directive === 'theme'}
	{...restProps}
>
	{@render children?.()}
</button>

<style>
	.button {
		border-radius: var(--border-small, 10px);
		padding-inline: calc(2 * var(--gap));
		padding-block: calc(var(--gap) / 2);
		cursor: pointer;
		background-color: white;
		border: 1px solid var(--grey);
		box-shadow:
			0 2px 6px rgb(0 0 0 / 0.08),
			0 1px 2px rgb(0 0 0 / 0.05);
		transition:
			transform 120ms ease,
			box-shadow 120ms ease;

		&.primary {
			color: white;
			border: 1px solid black;
			background: black;
		}

		&.secondary {
			color: black;
			border: 1px solid var(--grey);
			background: white;
		}

		&.theme {
			color: white;
			border: 1px solid var(--dark-emerald);
			background: var(--emerald);
		}
	}

	.button:hover {
		transform: translateY(1px) scale(0.99, 0.97);
		box-shadow:
			0 1px 4px rgb(0 0 0 / 0.08),
			0 1px 1px rgb(0 0 0 / 0.05);
	}

	.button:active {
		transform: translateY(2px) scale(0.985, 0.95);
		box-shadow:
			0 1px 2px rgb(0 0 0 / 0.1) inset,
			0 1px 1px rgb(0 0 0 / 0.05);
	}
</style>
