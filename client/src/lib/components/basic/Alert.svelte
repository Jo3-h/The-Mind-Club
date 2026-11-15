<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/components/branding/Icon.svelte';
	import type { IconName } from '$lib/icons/paths';
	import { slide } from 'svelte/transition';

	type Variant = 'info' | 'success' | 'warning' | 'danger';

	interface Props {
		variant?: Variant;
		title?: string;
		children?: Snippet;
		onclose?: () => void;
	}

	let { variant = 'info', title, children, onclose }: Props = $props();

	const iconFor: Record<Variant, IconName> = {
		info: 'info',
		success: 'check',
		warning: 'alertTriangle',
		danger: 'alertCircle'
	};

	// Errors interrupt screen readers; info and warnings are announced politely.
	const role = $derived(variant === 'danger' ? 'alert' : 'status');
</script>

<div class="alert {variant}" {role} transition:slide>
	<span class="icon"><Icon icon={iconFor[variant]} size="18px" /></span>

	<div class="body">
		{#if title}<p class="title">{title}</p>{/if}
		{#if children}<div class="message">{@render children()}</div>{/if}
	</div>

	{#if onclose}
		<button type="button" class="close" aria-label="Dismiss" onclick={onclose}>
			<Icon icon="cross" size="16px" />
		</button>
	{/if}
</div>

<style>
	.alert {
		/* Base styling is the info variant; other variants override these. */
		--accent: var(--dark-blue);
		--background: var(--lightest-blue);
		--border: var(--lighter-blue);
		--title: var(--darkest-blue);
		--message: var(--darker-blue);
		--hover: var(--lighter-blue);
		--focus: var(--blue);

		display: flex;
		margin: var(--gap);
		align-items: flex-start;
		gap: 1rem;
		padding: 1rem 1rem;
		border: 1px solid var(--border);
		border-radius: 1rem;
		background: var(--background);
		min-width: 20rem;
		font-family: var(--font-sans);
		font-size: var(--text-small, 0.875rem);
		line-height: 1.45;

		&.success {
			--accent: var(--green);
			--background: var(--lighter-green);
			--border: var(--light-green);
			--title: var(--darkest-green);
			--message: var(--darker-green);
			--hover: var(--light-green);
			--focus: var(--green);
		}

		&.warning {
			--accent: var(--yellow);
			--background: var(--lighter-yellow);
			--border: var(--light-yellow);
			--title: var(--darkest-yellow);
			--message: var(--darker-yellow);
			--hover: var(--light-yellow);
			--focus: var(--yellow);
		}

		&.danger {
			--accent: var(--red);
			--background: var(--lightest-red);
			--border: var(--lighter-red);
			--title: var(--darkest-red);
			--message: var(--darker-red);
			--hover: var(--lighter-red);
			--focus: var(--red);
		}
	}

	.alert:hover {
		background: var(--hover);
	}

	.icon {
		display: flex;
		flex-shrink: 0;
		color: var(--accent);
		/* nudge the icon onto the first line of text */
		margin-top: 1px;
	}

	.body {
		flex: 1;
		min-width: 0;
	}

	.title {
		margin: 0;
		font-weight: 600;
		color: var(--title);
		margin-block-end: var(--gap);
	}

	.message {
		color: var(--message);

		:global(p) {
			margin: 0;
		}
	}

	.title + .message {
		margin-top: 2px;
	}

	.close {
		display: flex;
		flex-shrink: 0;
		padding: 2px;
		margin: -2px -4px 0 0;
		border: none;
		border-radius: 4px;
		background: none;
		color: var(--accent);
		cursor: pointer;

		&:hover {
			background: var(--hover);
			color: var(--title);
		}

		&:focus-visible {
			outline: 2px solid var(--focus);
			outline-offset: 1px;
		}
	}
</style>
