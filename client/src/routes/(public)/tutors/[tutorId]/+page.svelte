<script lang="ts">
	import { resolve } from '$app/paths';
	import { withQuery } from '$lib/utils/links';
	import { DAYS } from '$lib/constants/onboarding';
	import { TEACHING_MODE_LABELS } from '$lib/constants/profile';
	import { formatCents } from '$lib/utils/money';
	import { formatSessionStart, minutesToLabel } from '$lib/utils/time';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const t = $derived(data.tutor);
	const backHref = $derived(withQuery(resolve('/tutors'), data.backQuery));
	const bookHref = $derived(
		withQuery(resolve('/sessions/new'), '', { tutor: t.id, course: data.highlightCourse })
	);

	const hoursByDay = $derived(
		DAYS.map((d) => ({ ...d, windows: data.hours.filter((w) => w.day === d.value) })).filter(
			(d) => d.windows.length > 0
		)
	);
	const solo = $derived(data.ladder[0]?.pricePerStudentCents ?? null);
	const zoneLabel = $derived(data.viewerTimeZone.split('/').pop()?.replace('_', ' '));

	function initials(name: string) {
		return name
			.split(' ')
			.map((p) => p[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}
</script>

<svelte:head><title>{t.name} · The Mind Club</title></svelte:head>

<div class="page">
	<a class="back" href={backHref}>← Back to results</a>

	<div class="layout">
		<div class="main">
			<header class="profile-head">
				<div class="avatar" aria-hidden="true">
					{#if t.image}<img src={t.image} alt="" />{:else}{initials(t.name)}{/if}
				</div>
				<div>
					<h1>{t.name}</h1>
					{#if t.headline}<p class="headline">{t.headline}</p>{/if}
					<p class="meta">
						{TEACHING_MODE_LABELS[t.teachingMode]}
						{#if t.teachingMode !== 'online' && t.suburb}
							· based in {t.suburb}{#if t.travelRadiusKm}, travels up to {t.travelRadiusKm} km{/if}
						{/if}
						· groups up to {t.maxGroupSize}
					</p>
					{#if !t.bookable}
						<span class="badge">Not taking bookings yet</span>
					{/if}
				</div>
			</header>

			{#if t.bio}
				<section>
					<h2>About</h2>
					<p class="bio">{t.bio}</p>
				</section>
			{/if}

			<section>
				<h2>Teaches</h2>
				{#if data.teaching.length === 0}
					<p class="muted">No chapters listed yet.</p>
				{:else}
					<ul class="courses">
						{#each data.teaching as c (c.key)}
							<li class:highlight={c.key === data.highlightCourse}>
								<details open={c.key === data.highlightCourse || data.teaching.length === 1}>
									<summary>
										<span class="course-name">Year {c.yearLevel} {c.name}</span>
										<span class="course-meta">
											{c.state ?? 'National'} · {c.chapters.length} chapter{c.chapters.length === 1
												? ''
												: 's'}
										</span>
									</summary>
									{#if c.textbook}<p class="textbook">Textbook: {c.textbook}</p>{/if}
									<ol class="chapters">
										{#each c.chapters as ch (ch.topicId)}
											<li><span class="chapter-no">{ch.chapter}</span>{ch.title}</li>
										{/each}
									</ol>
								</details>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section>
				<h2>Usual hours <span class="zone">({zoneLabel} time)</span></h2>
				{#if hoursByDay.length === 0}
					<p class="muted">No weekly hours set.</p>
				{:else}
					<dl class="hours">
						{#each hoursByDay as d (d.value)}
							<div>
								<dt>{d.long}</dt>
								<dd>
									{d.windows
										.map((w) => `${minutesToLabel(w.start)}–${minutesToLabel(w.end)}`)
										.join(', ')}
								</dd>
							</div>
						{/each}
					</dl>
				{/if}
			</section>

			{#if data.openGroups.length > 0}
				<section>
					<h2>Open groups you can join</h2>
					<ul class="groups">
						{#each data.openGroups as g (g.id)}
							{@const seatsLeft = g.capacity - g.seatsTaken}
							<li>
								<div class="group-main">
									<a class="group-title session-link" href={resolve(`/sessions/${g.id}`)}
										>{g.topicTitle}</a
									>
									<span class="meta">{g.courseLabel}</span>
									<span class="meta">
										{formatSessionStart(g.startsAt, data.viewerTimeZone)} · {g.durationMinutes} min ·
										{g.online ? 'Online' : `In person${g.suburb ? ` · ${g.suburb}` : ''}`}
									</span>
									<span class="meta">{seatsLeft} of {g.capacity} seats left</span>
								</div>
								<div class="group-price">
									{#if g.priceIfYouJoinCents < g.pricePerStudentCents}
										<span class="was">{formatCents(g.pricePerStudentCents)}</span>
										<span class="drop">{formatCents(g.priceIfYouJoinCents)}</span>
										<span class="note drop-note">if you join</span>
									{:else}
										<span class="now">{formatCents(g.pricePerStudentCents)}</span>
										<span class="note">per student</span>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		</div>

		<!-- the live price block: the one elevated element, amber for the drop -->
		<aside class="price-block" aria-label="Price per student">
			{#if data.ladder.length === 0}
				<p class="muted">
					{t.hasRate ? 'Pricing unavailable.' : 'This tutor hasn’t set a rate yet.'}
				</p>
			{:else}
				<p class="price-title">Price per student, per hour</p>
				<ul class="ladder">
					{#each data.ladder as step (step.groupSize)}
						<li
							class:cheapest={step.groupSize === data.ladder.at(-1)?.groupSize &&
								step.groupSize > 1}
						>
							<span>
								{step.groupSize === 1 ? '1:1' : `Group of ${step.groupSize}`}
							</span>
							<span class="ladder-price">{formatCents(step.pricePerStudentCents)}</span>
						</li>
					{/each}
				</ul>
				{#if solo !== null && data.ladder.length > 1}
					<p class="saving">
						Save up to {formatCents(solo - (data.ladder.at(-1)?.pricePerStudentCents ?? solo))} each in
						a full group.
					</p>
				{/if}
			{/if}

			{#if t.bookable}
				<a class="book" href={bookHref}>Book a session</a>
			{:else}
				<a class="book" href={bookHref}>Request a session</a>
				<p class="muted small">This tutor is finishing setup. You can still start a request.</p>
			{/if}
		</aside>
	</div>
</div>

<style>
	.page {
		width: 100%;
		max-width: 64rem;
		margin-inline: auto;
		padding: var(--gap-large);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		color: var(--tm-ink);
		font-size: 0.875rem;
	}

	.back {
		align-self: flex-start;
		color: var(--tm-muted);
		text-decoration: none;
		font-size: 0.8125rem;

		&:hover {
			color: var(--tm-ink);
			text-decoration: underline;
		}
	}

	.layout {
		display: grid;
		grid-template-columns: 1fr 18rem;
		gap: 2.5rem;
		align-items: start;
	}

	.main {
		display: flex;
		flex-direction: column;
		gap: 2rem;
		min-width: 0;
	}

	.profile-head {
		display: flex;
		gap: 1.25rem;
		align-items: flex-start;

		h1 {
			margin: 0;
			font-size: 2rem;
			font-weight: 600;
			letter-spacing: -0.01em;
		}
	}

	.avatar {
		flex-shrink: 0;
		display: grid;
		place-items: center;
		width: 4.5rem;
		height: 4.5rem;
		border-radius: 50%;
		background: var(--tm-surface-subtle);
		border: 1px solid var(--tm-border);
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--tm-muted);
		overflow: hidden;

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	.headline {
		margin: 0.25rem 0 0;
		font-size: 1rem;
	}

	.meta {
		margin: 0.25rem 0 0;
		font-size: 0.8125rem;
		color: var(--tm-muted);
	}

	.badge {
		display: inline-block;
		margin-top: 0.5rem;
		font-size: 0.6875rem;
		padding: 0.0625rem 0.5rem;
		border: 1px solid var(--tm-border);
		border-radius: 999px;
		color: var(--tm-muted);
	}

	section h2 {
		margin: 0 0 0.75rem;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--tm-muted);
	}

	.zone {
		text-transform: none;
		letter-spacing: 0;
		font-weight: 400;
	}

	.bio {
		margin: 0;
		line-height: 1.6;
		white-space: pre-line;
		font-size: 1rem;
	}

	.muted {
		color: var(--tm-muted);
		margin: 0;
	}

	.small {
		font-size: 0.75rem;
	}

	.courses,
	.groups {
		list-style: none;
		margin: 0;
		padding: 0;
		border: 1px solid var(--tm-border);
		border-radius: 8px;
		overflow: hidden;

		& > li + li {
			border-top: 1px solid var(--tm-border);
		}
	}

	.courses > li {
		padding: 0.75rem 1rem;

		&.highlight {
			box-shadow: inset 3px 0 0 var(--tm-green);
		}
	}

	summary {
		cursor: pointer;
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.course-name {
		font-weight: 500;
	}

	.course-meta,
	.textbook {
		font-size: 0.75rem;
		color: var(--tm-muted);
	}

	.textbook {
		margin: 0.5rem 0 0;
	}

	.chapters {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.chapter-no {
		display: inline-block;
		min-width: 1.5rem;
		color: var(--tm-muted);
		font-variant-numeric: tabular-nums;
	}

	.hours {
		margin: 0;
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.375rem 1.5rem;

		div {
			display: contents;
		}

		dt {
			color: var(--tm-muted);
		}

		dd {
			margin: 0;
			font-variant-numeric: tabular-nums;
		}
	}

	.groups li {
		display: flex;
		gap: 1rem;
		padding: 0.875rem 1rem;
	}

	.group-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;

		.meta {
			margin: 0;
		}
	}

	.group-title {
		font-weight: 600;
	}

	.group-price {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		justify-content: center;
		min-width: 5rem;
	}

	.was {
		font-size: 0.75rem;
		color: var(--tm-muted);
		text-decoration: line-through;
	}

	.drop,
	.now {
		font-size: 1.125rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.drop {
		color: var(--tm-amber);
	}

	.note {
		font-size: 0.6875rem;
		color: var(--tm-muted);
	}

	.drop-note {
		color: var(--tm-amber);
	}

	/* ---------- live price block ---------- */
	.price-block {
		position: sticky;
		top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.25rem;
		color: var(--lightest-primary);
		border: 1px solid var(--darkest-primary);
		border-radius: 10px;
		background: var(--dark-primary);
		box-shadow:
			0 1px 2px rgb(0 0 0 / 0.04),
			0 8px 24px rgb(0 0 0 / 0.06);
	}

	.price-title {
		margin: 0;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--lightest-primary);
	}

	.ladder {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;

		li {
			display: flex;
			justify-content: space-between;
			font-variant-numeric: tabular-nums;
		}

		.cheapest .ladder-price {
			color: var(--lighter-primary);
			font-weight: 600;
		}
	}

	.saving {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--lighter-primary);
	}

	.book {
		display: block;
		text-align: center;
		padding: 0.625rem 0.75rem;
		border-radius: 6px;
		background: var(--tm-green);
		color: #fff;
		font-weight: 500;
		text-decoration: none;

		&:hover {
			background: var(--tm-green-hover);
		}

		&:focus-visible {
			outline: 2px solid var(--tm-green);
			outline-offset: 2px;
		}
	}

	@media (max-width: 820px) {
		.layout {
			grid-template-columns: 1fr;
		}

		.price-block {
			position: static;
			order: -1;
		}
	}

	.session-link {
		color: var(--tm-green);
		text-decoration: none;

		&:hover {
			text-decoration: underline;
		}
	}
</style>
