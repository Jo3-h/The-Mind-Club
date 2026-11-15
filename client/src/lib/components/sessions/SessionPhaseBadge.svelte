<script lang="ts">
	type Phase = 'open' | 'locked' | 'in_progress' | 'finished' | 'completed' | 'cancelled';

	let { phase }: { phase: Phase } = $props();

	const LABELS: Record<Phase, string> = {
		open: 'Open',
		locked: 'Locked',
		in_progress: 'In progress',
		finished: 'Finished',
		completed: 'Completed',
		cancelled: 'Cancelled'
	};
</script>

<span class="badge {phase}">{LABELS[phase]}</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		padding: 0.125rem 0.5rem;
		border: 1px solid var(--tm-border);
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 500;
		line-height: 1.4;
		color: var(--tm-muted);
		background: var(--tm-surface);
		white-space: nowrap;
	}

	.open,
	.in_progress {
		color: var(--tm-green);
		border-color: color-mix(in srgb, var(--tm-green) 35%, transparent);
	}

	.cancelled {
		text-decoration: line-through;
	}
</style>
