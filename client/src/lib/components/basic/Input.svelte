<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends HTMLInputAttributes {
		mono?: boolean;
	}

	let { value = $bindable(), mono = false, ...restProps }: Props = $props();
</script>

<input class:mono bind:value {...restProps} />

<style>
	input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.375rem 0.625rem;
		border: 1px solid var(--grey);
		border-radius: 6px;
		background: #fff;
		font: inherit;
		transition:
			border-color 80ms ease,
			box-shadow 80ms ease;

		&:focus {
			outline: none;
			border-color: var(--orange);
			box-shadow: 0 0 0 3px color-mix(in srgb, var(--orange) 18%, transparent);
		}

		&.mono {
			font-family: 'IBM Plex Mono', ui-monospace, monospace;
			font-size: 0.8125rem;
		}
	}
</style>
