<script lang="ts">
	import { GROUP_SIZE_MIN, GROUP_SIZE_MAX } from '$lib/constants/onboarding';

	interface Props {
		value?: number;
		name?: string;
		min?: number;
		max?: number;
	}

	let {
		value = $bindable(4),
		name = 'maxGroupSize',
		min = GROUP_SIZE_MIN,
		max = GROUP_SIZE_MAX
	}: Props = $props();

	const caption = $derived(
		value === 1 ? '1:1 sessions only' : `Up to ${value} students in a session`
	);
</script>

<div class="stepper">
	<input type="hidden" {name} {value} />

	<button
		type="button"
		aria-label="Fewer students"
		disabled={value <= min}
		onclick={() => (value = Math.max(min, value - 1))}>−</button
	>

	<div class="value" aria-live="polite">
		<span class="number">{value}</span>
		<span class="caption">{caption}</span>
	</div>

	<button
		type="button"
		aria-label="More students"
		disabled={value >= max}
		onclick={() => (value = Math.min(max, value + 1))}>+</button
	>
</div>

<div class="dots" aria-hidden="true">
	{#each Array.from({ length: max }, (_, i) => i + 1) as n (n)}
		<span class="dot" class:on={n <= value}></span>
	{/each}
</div>

<style>
	.stepper {
		display: grid;
		grid-template-columns: 2.5rem 1fr 2.5rem;
		align-items: center;
		border: 1px solid #eaeaea;
		border-radius: 6px;
		padding: 0.25rem;
	}

	button {
		font: inherit;
		font-size: 1.125rem;
		height: 2.5rem;
		border: none;
		border-radius: 4px;
		background: none;
		cursor: pointer;
		color: #000;

		&:hover:not(:disabled) {
			background: #f5f5f5;
		}

		&:disabled {
			color: #ccc;
			cursor: default;
		}

		&:focus-visible {
			outline: 2px solid #0070f3;
		}
	}

	.value {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.125rem;
	}

	.number {
		font-size: 1.25rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.caption {
		font-size: 0.75rem;
		color: #666;
	}

	.dots {
		display: flex;
		gap: 0.25rem;
		justify-content: center;
		margin-block-start: 0.5rem;
	}

	.dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: #eaeaea;
		transition: background 150ms ease;

		&.on {
			background: #000;
		}
	}
</style>
