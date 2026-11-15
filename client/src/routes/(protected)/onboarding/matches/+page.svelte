<!--
	Where students land straight after onboarding.

	Read-only for now: cards aren't links until session and tutor pages exist.
	`?/notify` (no fields) flags the student's chapters for match alerts.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/basic/Button.svelte';
	import { formatCents } from '$lib/utils/money';
	import { formatSessionStart, formatWindow } from '$lib/utils/time';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const notified = $derived(form?.notified === true || data.alreadyNotified);

	const { openSessions, tutors } = $derived(data.recommendations);
	const hasMatches = $derived(openSessions.length > 0 || tutors.length > 0);
	let notifying = $state(false);

	const MODE_LABEL: Record<'online' | 'in_person' | 'both', string> = {
		online: 'Online',
		in_person: 'In person',
		both: 'Online or in person'
	};

	function initials(name: string) {
		return name
			.split(' ')
			.map((p) => p[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}
</script>

<svelte:head><title>Your matches · The Mind Club</title></svelte:head>

<div class="page">
	<div class="matches">
		<header>
			<span class="eyebrow"
				>YOU'RE ALL SET{data.firstName ? `, ${data.firstName.toUpperCase()}` : ''}</span
			>
			<h1>
				{#if hasMatches}
					Here's who fits your week
				{:else}
					We're still finding your match
				{/if}
			</h1>
			<p class="subtitle">
				{#if hasMatches}
					Based on the {data.topicCount} chapter{data.topicCount === 1 ? '' : 's'} you picked and the
					times you're free.
				{:else}
					No tutor covers your chapters at the times you picked yet. We'll let you know the moment
					one does.
				{/if}
			</p>
		</header>

		<!-- ============ OPEN GROUPS ============ -->
		{#if openSessions.length > 0}
			<section>
				<div class="section-head">
					<h2>Groups you can join</h2>
					<span class="count">{openSessions.length}</span>
				</div>
				<p class="section-hint">Already running on your topics, at times you're free.</p>

				<ul class="list">
					{#each openSessions as s (s.id)}
						{@const seatsLeft = s.capacity - s.joined}
						<li>
							<div class="card session">
								<div class="card-main">
									<span class="meta">{s.subjectLabel}</span>
									<a class="card-title session-link" href={resolve(`/sessions/${s.id}`)}
										>{s.topicTitle}</a
									>
									<span class="meta">
										{formatSessionStart(s.startsAt, data.timeZone)} · {s.durationMinutes} min · with {s.tutorName}
									</span>
									<span class="meta">
										{s.locationType === 'online'
											? 'Online'
											: `In person${s.suburb ? ` · ${s.suburb}` : ''}`}
									</span>

									<div class="seats" aria-label="{s.joined} of {s.capacity} seats taken">
										{#each Array.from({ length: s.capacity }, (_, i) => i) as i (i)}
											<span class="seat" class:taken={i < s.joined}></span>
										{/each}
										<span class="seats-label">
											{seatsLeft} seat{seatsLeft === 1 ? '' : 's'} left
										</span>
									</div>
								</div>

								<div class="price-block">
									{#if s.priceIfYouJoin < s.pricePerStudent}
										<span class="was">{formatCents(s.pricePerStudent)}</span>
										<span class="price drop">{formatCents(s.priceIfYouJoin)}</span>
										<span class="price-note drop">if you join</span>
									{:else}
										<span class="price">{formatCents(s.pricePerStudent)}</span>
										<span class="price-note">per student</span>
									{/if}
								</div>
							</div>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<!-- ============ TUTORS ============ -->
		{#if tutors.length > 0}
			<section>
				<div class="section-head">
					<h2>Recommended tutors</h2>
					<span class="count">{tutors.length}</span>
				</div>
				<p class="section-hint">
					Teach your chapters and are free when you are. Start a session with one.
				</p>

				<ul class="list">
					{#each tutors as t (t.id)}
						{@const full = t.coveredTopics.length === t.totalTopics}
						<li>
							<a class="card tutor link" href={resolve(`/tutors/${t.id}`)}>
								<div class="avatar">
									{#if t.avatarUrl}
										<img src={t.avatarUrl} alt="" />
									{:else}
										{initials(t.name)}
									{/if}
								</div>

								<div class="card-main">
									<span class="card-title">{t.name}</span>
									<span class="meta">{t.headline}</span>

									<span class="coverage" class:full>
										{full
											? `Covers all ${t.totalTopics} of your chapters`
											: `Covers ${t.coveredTopics.length} of your ${t.totalTopics} chapters`}
									</span>

									{#if t.overlaps.length > 0}
										<div class="windows">
											{#each t.overlaps.slice(0, 4) as w (`${w.day}-${w.start}`)}
												<span class="window">{formatWindow(w)}</span>
											{/each}
											{#if t.overlaps.length > 4}
												<span class="window more">+{t.overlaps.length - 4} more</span>
											{/if}
										</div>
									{/if}

									<span class="meta">
										{MODE_LABEL[t.teachingMode]} · groups up to {t.maxGroupSize}
										{#if t.openSessionCount > 0}
											· {t.openSessionCount} open session{t.openSessionCount === 1 ? '' : 's'}
										{/if}
									</span>
								</div>

								{#if t.fromPricePerStudent}
									<div class="price-block">
										<span class="price-note">from</span>
										<span class="price drop">{formatCents(t.fromPricePerStudent)}</span>
										<span class="price-note">in a full group</span>
									</div>
								{/if}
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<!-- ============ EMPTY STATE ============ -->
		{#if !hasMatches}
			<section class="empty">
				{#if notified}
					<p class="confirm" role="status">
						Done — we'll email you when a tutor or group opens up for your chapters.
					</p>
				{:else}
					<form
						method="post"
						action="?/notify"
						use:enhance={() => {
							notifying = true;
							return async ({ update }) => {
								await update();
								notifying = false;
							};
						}}
					>
						<Button directive="theme" disabled={notifying}>
							{notifying ? 'Saving…' : 'Notify me when there’s a match'}
						</Button>
					</form>
				{/if}
			</section>
		{/if}

		<footer>
			<a href={resolve('/account')} class="secondary">Go to your account →</a>
		</footer>
	</div>
</div>

<style>
	.page {
		display: grid;
		justify-items: center;
		width: 100%;
	}

	.matches {
		display: flex;
		flex-direction: column;
		gap: 2rem;
		width: 100%;
		max-width: 40rem;
		padding-block: 4rem 5rem;
		padding-inline: var(--gap-large);
		font-size: var(--text-small);
		color: #000;
	}

	header {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.eyebrow {
		font-size: 0.6875rem;
		letter-spacing: 0.06em;
		color: #666;
	}

	h1 {
		font-size: var(--text-large);
		font-weight: bold;
		margin: 0;
	}

	.subtitle {
		color: #666;
		margin: 0;
		line-height: 1.5;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.section-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	h2 {
		font-size: 0.6875rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		font-weight: 600;
		margin: 0;
	}

	.count {
		font-size: 0.6875rem;
		color: #666;
		background: #f5f5f5;
		border-radius: 999px;
		padding: 0 0.4rem;
		font-variant-numeric: tabular-nums;
	}

	.section-hint {
		color: #666;
		margin: 0 0 0.25rem;
		font-size: 0.75rem;
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		border: 1px solid #eaeaea;
		border-radius: 6px;
	}

	.list li + li {
		border-top: 1px solid #eaeaea;
	}

	.card {
		display: flex;
		gap: 0.875rem;
		padding: 0.875rem 1rem;
		color: inherit;
		text-decoration: none;
	}

	a.card {
		color: inherit;
		text-decoration: none;

		&:hover {
			background: #fafafa;
		}

		&:focus-visible {
			outline: 2px solid var(--tm-green);
			outline-offset: -2px;
		}
	}

	.card-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}

	.card-title {
		font-weight: 600;
	}

	.meta {
		color: #666;
		font-size: 0.75rem;
	}

	.seats {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-block-start: 0.25rem;
	}

	.seat {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		border: 1px solid #ccc;

		&.taken {
			background: #000;
			border-color: #000;
		}
	}

	.seats-label {
		margin-inline-start: 0.375rem;
		font-size: 0.75rem;
		color: #666;
	}

	/* the price block is the one elevated element; amber is reserved for the price drop */
	.price-block {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		justify-content: center;
		gap: 0.125rem;
		min-width: 5rem;
		text-align: right;
	}

	.price {
		font-size: 1.125rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;

		&.drop {
			color: #b8842e;
		}
	}

	.was {
		font-size: 0.75rem;
		color: #999;
		text-decoration: line-through;
		font-variant-numeric: tabular-nums;
	}

	.price-note {
		font-size: 0.6875rem;
		color: #666;

		&.drop {
			color: #b8842e;
		}
	}

	.avatar {
		flex-shrink: 0;
		display: grid;
		place-items: center;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		background: #f0f0f0;
		font-size: 0.75rem;
		font-weight: 600;
		color: #666;
		overflow: hidden;

		& img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	.coverage {
		font-size: 0.75rem;
		color: #666;

		&.full {
			color: #000;
		}
	}

	.windows {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-block: 0.125rem;
	}

	.window {
		font-size: 0.6875rem;
		padding: 0.125rem 0.4rem;
		background: #f5f5f5;
		border-radius: 4px;
		font-variant-numeric: tabular-nums;

		&.more {
			color: #666;
		}
	}

	.empty {
		align-items: flex-start;
		padding: 1.25rem;
		border: 1px dashed #eaeaea;
		border-radius: 6px;
		gap: 0.75rem;
	}

	.confirm {
		margin: 0;
	}

	footer {
		display: flex;
		justify-content: flex-end;
		padding-block-start: 1rem;
		border-top: 1px solid #eaeaea;
	}

	.secondary {
		color: #666;
		text-decoration: none;

		&:hover {
			color: #000;
		}
	}

	@media (max-width: 480px) {
		.card {
			flex-wrap: wrap;
		}

		.price-block {
			flex-direction: row;
			align-items: baseline;
			gap: 0.375rem;
			width: 100%;
			justify-content: flex-start;
			min-width: 0;
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
