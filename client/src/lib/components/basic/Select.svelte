<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLSelectAttributes } from 'svelte/elements';

	interface Props extends HTMLSelectAttributes {
		mono?: boolean;
		children?: Snippet;
	}

	let { value = $bindable(), mono = false, children, ...restProps }: Props = $props();
</script>

<span class="select">
	<select class:mono bind:value {...restProps}>
		{@render children?.()}
	</select>
</span>

<style>
	.select {
		position: relative;
		display: block;
		width: 100%;

		&::after {
			content: '';
			position: absolute;
			top: 50%;
			right: 0.75rem;
			width: 0.375rem;
			height: 0.375rem;
			border-right: 1.5px solid currentColor;
			border-bottom: 1.5px solid currentColor;
			transform: translateY(-70%) rotate(45deg);
			opacity: 0.55;
			pointer-events: none;
		}
	}

	select {
		appearance: none;
		width: 100%;
		box-sizing: border-box;
		padding: 0.375rem 2rem 0.375rem 0.625rem;
		border: 1px solid var(--grey);
		border-radius: 6px;
		background: #fff;
		color: inherit;
		font: inherit;
		cursor: pointer;
		transition:
			border-color 80ms ease,
			box-shadow 80ms ease;

		&:focus {
			outline: none;
			border-color: var(--orange);
			box-shadow: 0 0 0 3px color-mix(in srgb, var(--orange) 18%, transparent);
		}

		&:disabled {
			cursor: not-allowed;
			opacity: 0.6;
		}

		&.mono {
			font-family: 'IBM Plex Mono', ui-monospace, monospace;
			font-size: 0.8125rem;
		}
	}
</style>
