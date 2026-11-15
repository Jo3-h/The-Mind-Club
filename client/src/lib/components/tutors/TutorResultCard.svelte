<!--
	One tutor in search results. Flat row with a hairline border; the only accent is amber on
	the "from" price, because that number IS the price-drop signal (bigger group → cheaper).
-->
<script lang="ts">
	import type { ResolvedPathname } from '$app/types';
	import type { AvailabilityWindow as WeeklyWindow } from '$lib/types/onboarding';
	import { TEACHING_MODE_LABELS, type TeachingMode } from '$lib/constants/profile';
	import { formatCents } from '$lib/utils/money';
	import { formatWindow } from '$lib/utils/time';
	import { fly } from 'svelte/transition';

	type Result = {
		name: string;
		image: string | null;
		headline: string | null;
		teachingMode: TeachingMode;
		suburb: string | null;
		maxGroupSize: number;
		bookable: boolean;
		fromPriceCents: number | null;
		openGroupCount: number;
		/** Which of the searched courses they teach, most complete first. */
		courses: { key: string; covered: number; total: number }[];
		hours: WeeklyWindow[];
		sharedTimes: WeeklyWindow[];
		distanceKm: number | null;
	};

	let {
		tutor,
		href,
		courseLabels
	}: {
		tutor: Result;
		href: ResolvedPathname;
		/** course key → display name, e.g. "Year 11 Mathematical Methods (SA)" */
		courseLabels: Record<string, string>;
	} = $props();

	const MAX_CHIPS = 4;
	const MAX_COURSES = 2;
	const times = $derived(tutor.sharedTimes.length > 0 ? tutor.sharedTimes : tutor.hours);

	const chapters = (c: { covered: number; total: number }) =>
		c.covered === c.total
			? `all ${c.total} chapter${c.total === 1 ? '' : 's'}`
			: `${c.covered} of ${c.total} chapters`;

	function initials(name: string) {
		return name
			.split(' ')
			.map((p) => p[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}
</script>

<a class="card" {href}>
	<div class="avatar" aria-hidden="true">
		{#if tutor.image}
			<img src={tutor.image} alt="" />
		{:else}
			{initials(tutor.name)}
		{/if}
	</div>

	<div class="main">
		<div class="title-row">
			<span class="name">{tutor.name}</span>
			{#if !tutor.bookable}
				<span class="badge">Not taking bookings yet</span>
			{/if}
		</div>
		{#if tutor.headline}<span class="headline">{tutor.headline}</span>{/if}

		<ul class="coverage" aria-label="Courses taught">
			{#each tutor.courses.slice(0, MAX_COURSES) as c (c.key)}
				<li class:full={c.covered === c.total}>
					{courseLabels[c.key] ?? c.key} · {chapters(c)}
				</li>
			{/each}
			{#if tutor.courses.length > MAX_COURSES}
				<li class="more">
					+{tutor.courses.length - MAX_COURSES} more course{tutor.courses.length - MAX_COURSES === 1
						? ''
						: 's'}
				</li>
			{/if}
		</ul>

		{#if times.length > 0}
			<div class="times">
				<span class="times-label"
					>{tutor.sharedTimes.length > 0 ? 'Free when you are' : 'Usually free'}</span
				>
				{#each times.slice(0, MAX_CHIPS) as w (`${w.day}-${w.start}`)}
					<span class="chip" transition:fly={{ x: 300, duration: 200 }}>{formatWindow(w)}</span>
				{/each}
				{#if times.length > MAX_CHIPS}
					<span class="chip more">+{times.length - MAX_CHIPS} more</span>
				{/if}
			</div>
		{/if}

		<span class="meta">
			{TEACHING_MODE_LABELS[tutor.teachingMode]}
			{#if tutor.teachingMode !== 'online' && tutor.suburb}
				· {tutor.suburb}{#if tutor.distanceKm !== null}&nbsp;({tutor.distanceKm} km){/if}
			{/if}
			· groups up to {tutor.maxGroupSize}
			{#if tutor.openGroupCount > 0}
				· <strong>{tutor.openGroupCount} open group{tutor.openGroupCount === 1 ? '' : 's'}</strong>
			{/if}
		</span>
	</div>

	<div class="price">
		{#if tutor.fromPriceCents !== null}
			<span class="price-note">from</span>
			<span class="price-value">{formatCents(tutor.fromPriceCents)}</span>
			<span class="price-note">per student / hr in a full group</span>
		{:else}
			<span class="price-note">Rate not set yet</span>
		{/if}
	</div>
</a>

<style>
	.card {
		display: flex;
		gap: 1rem;
		padding: 1rem;
		color: inherit;
		text-decoration: none;
		background: var(--lightest-grey);
		transition: background 100ms ease;

		&:hover {
			background: var(--lighter-grey);
		}

		&:focus-visible {
			outline: 2px solid var(--lighter-grey);
			outline-offset: -2px;
		}
	}

	.avatar {
		flex-shrink: 0;
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 50%;
		background: var(--tm-surface-subtle);
		border: 1px solid var(--tm-border);
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--tm-muted);
		overflow: hidden;

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	.main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.name {
		font-size: 1.0625rem;
		font-weight: 600;
	}

	.badge {
		font-size: 0.6875rem;
		padding: 0.0625rem 0.4rem;
		border: 1px solid var(--tm-border);
		border-radius: 999px;
		color: var(--tm-muted);
	}

	.headline {
		color: var(--tm-muted);
		font-size: 0.8125rem;
	}

	.coverage {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--gap);
		font-size: var(--text-small);
		color: var(--tm-muted);

		.full {
			color: var(--tm-green);
			font-weight: 500;
		}
	}

	.times {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
	}

	.times-label {
		font-size: 0.6875rem;
		color: var(--tm-muted);
		margin-right: 0.125rem;
	}

	.chip {
		font-size: 0.6875rem;
		padding: 0.125rem 0.4rem;
		background: var(--tm-surface-subtle);
		border: 1px solid var(--tm-border);
		border-radius: 4px;
		font-variant-numeric: tabular-nums;

		&.more {
			color: var(--tm-muted);
		}
	}

	.meta {
		font-size: 0.75rem;
		color: var(--tm-muted);

		strong {
			color: var(--tm-ink);
			font-weight: 500;
		}
	}

	.price {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		justify-content: center;
		text-align: right;
		min-width: 6.5rem;
		gap: 0.125rem;
	}

	.price-value {
		font-size: var(--text-large);
		font-weight: bold;
		font-variant-numeric: tabular-nums;
		color: var(--dark-primary);
	}

	.price-note {
		font-size: 0.6875rem;
		color: var(--tm-muted);
		max-width: 8rem;
	}

	@media (max-width: 560px) {
		.card {
			flex-wrap: wrap;
		}

		.price {
			flex-direction: row;
			align-items: baseline;
			gap: 0.375rem;
			width: 100%;
			justify-content: flex-start;
			text-align: left;
			padding-left: 3.75rem;
		}

		.price-note {
			max-width: none;
		}
	}
</style>
