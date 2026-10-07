<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLDivElement> & {
		fit?: boolean;
	};

	const { children, fit = false, class: className, ...restProps }: Props = $props();
</script>

<div class={`box ${fit ? 'box--fit' : 'box--fill'} ${className ?? ''}`} {...restProps}>
	{@render children?.()}
</div>

<style>
	.box {
		border-radius: var(--border-radius, 10px);
		border: 1px solid var(--lightest-orange);
		padding: 0.5rem;
		color: black;
		box-shadow:
			0 6px 14px rgb(0 0 0 / 0.12),
			0 2px 4px rgb(0 0 0 / 0.08);
		transition:
			transform 120ms ease,
			box-shadow 120ms ease;
	}
	.box--fill {
		width: 100%;
	}

	.box--fit {
		width: fit-content;
		align-self: flex-start;
	}
</style>
