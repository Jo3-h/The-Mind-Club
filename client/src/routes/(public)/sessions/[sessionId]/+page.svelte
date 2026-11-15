<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Alert from '$lib/components/basic/Alert.svelte';
	import SessionPhaseBadge from '$lib/components/sessions/SessionPhaseBadge.svelte';
	import { formatCents } from '$lib/utils/money';
	import { formatSessionStart } from '$lib/utils/time';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const s = $derived(data.session);
	const seatsLeft = $derived(s.capacity - data.seatsTaken);
	const zoneLabel = $derived(data.timeZone.split('/').pop()?.replace('_', ' '));
	const canJoin = $derived(data.join.reason === 'joinable' && !data.viewer.isTutor);
	const showBlocked = $derived(
		!data.viewer.inSession && !data.viewer.isTutor && data.join.reason !== 'joinable'
	);
	let busy = $state(false);

	const submit = () => {
		busy = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			busy = false;
		};
	};
</script>

<svelte:head><title>{s.topicTitle} · The Mind Club</title></svelte:head>

<div class="page">
	{#if data.justBooked && data.myBooking && !form}
		<Alert variant="info" title="You're booked in">
			{#if s.visibility === 'open'}
				Share this page with classmates: every student who joins lowers the price for everyone.
			{:else}
				It's on your sessions page.
			{/if}
		</Alert>
	{/if}
	{#if form?.error}
		<Alert variant="error">{form.error}</Alert>
	{:else if form?.joined}
		<Alert variant="info" title="You're in">Your seat is confirmed.</Alert>
	{:else if form?.left}
		<Alert variant="info">You've left this session.</Alert>
	{/if}

	<div class="layout">
		<div class="main">
			<header>
				<div class="title-row">
					<h1>{s.topicTitle}</h1>
					<SessionPhaseBadge phase={data.phase} />
				</div>
				<p class="muted">
					{s.courseLabel} · with
					<a href={resolve(`/tutors/${s.tutor.id}`)}>{s.tutor.name}</a>
				</p>
			</header>

			<dl class="details">
				<div>
					<dt>When</dt>
					<dd>
						{formatSessionStart(s.startsAt, data.timeZone)} · {s.durationMinutes} min
						<span class="muted small">({zoneLabel} time)</span>
					</dd>
				</div>
				<div>
					<dt>Where</dt>
					<dd>
						{s.locationLabel.replace(' (1:1 only)', '')}{s.suburb ? ` · ${s.suburb}` : ''}
						{#if s.addressLine}
							<span class="block">{s.addressLine}</span>
						{:else if data.viewer.inSession && s.locationType !== 'online'}
							<span class="block muted small">
								{data.viewer.isTutor
									? 'Share the exact address with your students.'
									: 'Your tutor will share the exact address.'}
							</span>
						{:else if !data.viewer.inSession && s.locationType !== 'online'}
							<span class="block muted small">The exact place is shared once you've joined.</span>
						{/if}
					</dd>
				</div>
				<div>
					<dt>Group</dt>
					<dd>
						{#if s.capacity === 1}
							Private 1:1
						{:else}
							{data.seatsTaken} of {s.capacity} students{s.visibility === 'private'
								? ' · private'
								: ''}
						{/if}
					</dd>
				</div>
				{#if data.phase === 'open' && s.capacity > 1}
					<div>
						<dt>Locks</dt>
						<dd>
							{formatSessionStart(s.lockAt, data.timeZone)}
							<span class="block muted small">After this nobody can join or leave.</span>
						</dd>
					</div>
				{/if}
				{#if s.cancelReason}
					<div>
						<dt>Cancelled</dt>
						<dd>{s.cancelReason}</dd>
					</div>
				{/if}
			</dl>

			{#if data.meeting && data.viewer.inSession && data.phase !== 'cancelled'}
				<section class="meeting">
					<h2>Online meeting</h2>
					{#if !data.meeting.ready}
						<p class="muted">
							{#if data.viewer.isTutor}
								Add your meeting link on <a href={resolve('/account')}>your account</a> so students can
								join.
							{:else}
								Your tutor hasn't added a meeting link yet.
							{/if}
						</p>
					{:else if data.meeting.open}
						<a class="primary" href={resolve(`/sessions/${s.id}/join`)} data-sveltekit-reload
							>Join meeting</a
						>
					{:else}
						<p class="muted">
							The Join button opens at {formatSessionStart(data.meeting.opensAt, data.timeZone)}.
						</p>
					{/if}
				</section>
			{/if}

			{#if data.roster}
				<section>
					<h2>Students</h2>
					{#if data.roster.students.length === 0}
						<p class="muted">Nobody yet.</p>
					{:else}
						<ul class="roster">
							{#each data.roster.students as st, i (i)}
								<li>
									<span>{st.name}</span>
									<span class="muted small">{st.status}</span>
								</li>
							{/each}
						</ul>
						<p class="muted small">
							You'd earn {formatCents(data.roster.earningsCents)} at today's group size, after the platform
							fee.
						</p>
					{/if}
				</section>
			{/if}
		</div>

		<!-- the live price block: the one elevated element, amber for the drop -->
		<aside class="price-block" aria-label="Price per student">
			{#if !data.prices}
				<p class="muted">Pricing isn't available for this session.</p>
			{:else}
				<p class="price-title">Price per student now</p>
				<p class="price-now">{formatCents(data.prices.nowCents)}</p>
				{#if data.phase === 'open' && data.prices.ifOneMoreCents !== null && data.prices.ifOneMoreCents < data.prices.nowCents}
					<p class="drop">
						↓ {formatCents(data.prices.ifOneMoreCents)} each if one more joins
					</p>
				{/if}
				{#if s.capacity > 1 && data.prices.lowestCents < data.prices.nowCents}
					<p class="muted small">
						{formatCents(data.prices.lowestCents)} each with a full group of {s.capacity}.
					</p>
				{/if}
				{#if s.capacity > 1 && data.phase === 'open'}
					<p class="seats">{seatsLeft} {seatsLeft === 1 ? 'seat' : 'seats'} left</p>
				{/if}
			{/if}

			{#if data.myBooking}
				<div class="mine">
					<p>You'll pay <strong>{formatCents(data.myBooking.payNowCents)}</strong></p>
					<p class="muted small">
						Never more than {formatCents(data.myBooking.capCents)}, and less if more students join.
					</p>
				</div>
			{/if}

			{#if canJoin}
				<form method="POST" action="?/join" use:enhance={submit}>
					<button class="primary" type="submit" disabled={busy}>
						{data.viewer.loggedIn ? 'Join this session' : 'Log in to join'}
					</button>
				</form>
			{:else if showBlocked && data.join.message}
				<p class="muted small">{data.join.message}</p>
			{/if}

			{#if data.myBooking?.canLeave}
				<form method="POST" action="?/leave" use:enhance={submit}>
					<button class="secondary" type="submit" disabled={busy}>Leave session</button>
				</form>
			{/if}
			<p class="muted small">Booking fee included. No payment is taken yet.</p>
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
		gap: 1rem;
		color: var(--tm-ink);
		line-height: 1.5;
	}

	p {
		margin: 0;
	}

	a {
		color: var(--tm-green);
		font-weight: 500;
	}

	.muted {
		color: var(--tm-muted);
	}

	.small {
		font-size: 0.8125rem;
	}

	.block {
		display: block;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 18rem;
		gap: 2rem;
		align-items: start;
	}

	.main {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	header {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.title-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	h1 {
		margin: 0;
		font-family: 'Source Serif 4', serif;
		font-size: 1.75rem;
		font-weight: 600;
	}

	h2 {
		margin: 0 0 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.details {
		margin: 0;
		border-top: 1px solid var(--tm-border);

		div {
			display: grid;
			grid-template-columns: 6rem minmax(0, 1fr);
			gap: 1rem;
			padding-block: 0.75rem;
			border-bottom: 1px solid var(--tm-border);
		}

		dt {
			color: var(--tm-muted);
			font-size: 0.875rem;
		}

		dd {
			margin: 0;
		}
	}

	.roster {
		list-style: none;
		margin: 0 0 0.5rem;
		padding: 0;
		border: 1px solid var(--tm-border);
		border-radius: 8px;

		li {
			display: flex;
			justify-content: space-between;
			padding: 0.5rem 0.75rem;
		}

		li + li {
			border-top: 1px solid var(--tm-border);
		}
	}

	/* ---------- live price block ---------- */
	.price-block {
		position: sticky;
		top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.25rem;
		border: 1px solid var(--tm-border);
		border-radius: 10px;
		background: var(--tm-surface);
		box-shadow:
			0 1px 2px rgb(0 0 0 / 0.04),
			0 8px 24px rgb(0 0 0 / 0.06);
	}

	.price-title {
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--tm-muted);
	}

	.price-now {
		font-size: 1.75rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.drop {
		color: var(--tm-amber);
		font-weight: 600;
	}

	.seats {
		font-size: 0.875rem;
		font-weight: 500;
	}

	.mine {
		padding-top: 0.75rem;
		border-top: 1px solid var(--tm-border);
	}

	form {
		display: contents;
	}

	.primary,
	.secondary {
		display: block;
		width: 100%;
		box-sizing: border-box;
		text-align: center;
		padding: 0.625rem 0.75rem;
		border-radius: 6px;
		font: inherit;
		font-weight: 500;
		text-decoration: none;
		cursor: pointer;

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		&:focus-visible {
			outline: 2px solid var(--tm-green);
			outline-offset: 2px;
		}
	}

	.primary {
		border: 0;
		background: var(--tm-green);
		color: #fff;

		&:hover:not(:disabled) {
			background: var(--tm-green-hover);
		}
	}

	.secondary {
		border: 1px solid var(--tm-border);
		background: var(--tm-surface);
		color: var(--tm-ink);

		&:hover:not(:disabled) {
			background: var(--tm-surface-hover);
		}
	}

	.meeting .primary {
		max-width: 14rem;
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
</style>
