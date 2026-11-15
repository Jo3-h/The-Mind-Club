<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger';

	interface Props extends HTMLButtonAttributes {
		variant?: Variant;
	}

	const { children, variant = 'secondary', ...restProps }: Props = $props();
</script>

<button
	class="button"
	class:primary={variant === 'primary'}
	class:info={variant === 'info'}
	class:success={variant === 'success'}
	class:warning={variant === 'warning'}
	class:danger={variant === 'danger'}
	{...restProps}
>
	{@render children?.()}
</button>

<style>
	.button {
		--border: var(--grey);
		--background: var(--lightest-grey);
		--hover: var(--light-grey);
		--colour: var(--darkest-grey);
		--shadow: 0 1px 2px rgb(15 23 32 / 0.08), 0 0 0 1px rgb(15 23 32 / 0.04);

		box-shadow: var(--shadow);
		transition:
			background-color 120ms ease,
			box-shadow 120ms ease,
			transform 80ms ease;
		border-radius: var(--border-radius, 10px);
		padding-inline: 0.95rem;
		padding-block: 0.55rem;
		letter-spacing: 0.05em;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		background-color: white;
		font-weight: bold;
		color: var(--colour);
		background-color: var(--background);
		border: 1px solid var(--border);

		&:hover:not(:disabled) {
			box-shadow:
				0 2px 4px rgb(15 23 32 / 0.1),
				0 0 0 1px rgb(15 23 32 / 0.06);
		}

		&:active:not(:disabled) {
			transform: translateY(1px);
			box-shadow: 0 0 0 1px rgb(15 23 32 / 0.06);
		}

		&.primary {
			--border: var(--darker-primary);
			--background: var(--primary);
			--colour: white;
			--hover: var(--dark-primary);
		}

		&.info {
			--border: var(--blue);
			--background: var(--light-blue);
			--colour: var(--lightest-blue);
			--hover: var(--blue);
		}

		&.success {
			--border: var(--dark-green);
			--background: var(--green);
			--colour: var(--lightest-green);
			--hover: var(--dark-green);
		}

		&.warning {
			--border: var(--dark-yellow);
			--background: var(--yellow);
			--colour: var(--lightest-yellow);
			--hover: var(--dark-yellow);
		}

		&.danger {
			--border: var(--dark-red);
			--background: var(--red);
			--colour: var(--lightest-red);
			--hover: var(--dark-red);
		}
	}

	.button:hover {
		transform: translateY(1px) scale(0.99, 0.97);
		background-color: var(--hover);
		box-shadow:
			0 1px 4px rgb(0 0 0 / 0.08),
			0 1px 1px rgb(0 0 0 / 0.05);
	}

	.button:active {
		transform: translateY(2px) scale(0.985, 0.95);
		background-color: var(--hover);
		box-shadow:
			0 1px 2px rgb(0 0 0 / 0.1) inset,
			0 1px 1px rgb(0 0 0 / 0.05);
	}

	.button:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}
</style>
