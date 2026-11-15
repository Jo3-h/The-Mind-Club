<script lang="ts">
	import { resolve } from '$app/paths';
	import SessionPhaseBadge from '$lib/components/sessions/SessionPhaseBadge.svelte';
	import { formatCents } from '$lib/utils/money';
	import { formatSessionStart } from '$lib/utils/time';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let tab = $state<'upcoming' | 'past'>('upcoming');
	const rows = $derived(tab === 'upcoming' ? data.upcoming : data.past);
	const isTutor = $derived(data.role === 'tutor');
</script>

<svelte:head><title>My sessions · The Mind Club</title></svelte:head>

<div class="page">
	<h1>My sessions</h1>

	{#if data.role === 'other'}
		<p class="muted">Sessions are for student and tutor accounts.</p>
	{:else}
		<div class="tabs" role="tablist">
			<button
				role="tab"
				aria-selected={tab === 'upcoming'}
				class:selected={tab === 'upcoming'}
				onclick={() => (tab = 'upcoming')}>Upcoming <span>{data.upcoming.length}</span></button
			>
			<button
				role="tab"
				aria-selected={tab === 'past'}
				class:selected={tab === 'past'}
				onclick={() => (tab = 'past')}>Past <span>{data.past.length}</span></button
			>
		</div>

		{#if rows.length === 0}
			<div class="empty">
				{#if tab === 'upcoming'}
					<p>No upcoming sessions.</p>
					{#if !isTutor}
						<a href={resolve('/tutors')}>Find a tutor →</a>
					{/if}
				{:else}
					<p>No past sessions yet.</p>
				{/if}
			</div>
		{:else}
			<ul class="list">
				{#each rows as r (r.id)}
					<li>
						<a href={resolve(`/sessions/${r.id}`)}>
							<div class="when">
								<span>{formatSessionStart(r.startsAt, data.timeZone)}</span>
								<span class="muted small">{r.durationMinutes} min</span>
							</div>
							<div class="what">
								<span class="title">{r.topicTitle}</span>
								<span class="muted small"
									>{r.courseLabel} · {isTutor ? r.with : `with ${r.with}`}</span
								>
								<span class="muted small">{r.where}</span>
							</div>
							<div class="side">
								<SessionPhaseBadge phase={r.phase} />
								<span class="muted small">
									{r.group.capacity === 1 ? '1:1' : `${r.group.taken} of ${r.group.capacity}`}
								</span>
								{#if r.priceCents !== null}
									<span class="price">
										{formatCents(r.priceCents)}
										<span class="muted small">{isTutor ? 'you earn' : 'you pay'}</span>
									</span>
								{/if}
							</div>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>

<style>
	.page {
		width: 100%;
		max-width: 52rem;
		margin-inline: auto;
		padding: var(--gap-large);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		color: var(--tm-ink);
		line-height: 1.5;
	}

	h1 {
		margin: 0;
		font-family: 'Source Serif 4', serif;
		font-size: 1.75rem;
		font-weight: 600;
	}

	p {
		margin: 0;
	}

	.muted {
		color: var(--tm-muted);
	}

	.small {
		font-size: 0.8125rem;
	}

	.tabs {
		display: flex;
		gap: 1rem;
		border-bottom: 1px solid var(--tm-border);

		button {
			padding: 0.5rem 0;
			border: 0;
			border-bottom: 2px solid transparent;
			background: none;
			font: inherit;
			color: var(--tm-muted);
			cursor: pointer;

			span {
				font-size: 0.75rem;
				font-variant-numeric: tabular-nums;
			}

			&.selected {
				color: var(--tm-ink);
				border-bottom-color: var(--tm-green);
				font-weight: 500;
			}

			&:focus-visible {
				outline: 2px solid var(--tm-green);
				outline-offset: 2px;
			}
		}
	}

	.empty {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 2rem 0;

		a {
			color: var(--tm-green);
			font-weight: 500;
		}
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		border: 1px solid var(--tm-border);
		border-radius: 10px;
		overflow: hidden;

		li + li {
			border-top: 1px solid var(--tm-border);
		}

		a {
			display: grid;
			grid-template-columns: 10rem minmax(0, 1fr) auto;
			gap: 1rem;
			padding: 0.875rem 1rem;
			color: inherit;
			text-decoration: none;

			&:hover {
				background: var(--tm-surface-hover);
			}

			&:focus-visible {
				outline: 2px solid var(--tm-green);
				outline-offset: -2px;
			}
		}
	}

	.when,
	.what,
	.side {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.title {
		font-weight: 600;
	}

	.side {
		align-items: flex-end;
	}

	.price {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	@media (max-width: 640px) {
		.list a {
			grid-template-columns: 1fr;
		}

		.side {
			align-items: flex-start;
			flex-direction: row;
			flex-wrap: wrap;
			gap: 0.5rem;
		}
	}
</style>
