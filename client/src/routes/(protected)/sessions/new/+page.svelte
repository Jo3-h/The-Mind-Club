<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Alert from '$lib/components/basic/Alert.svelte';
	import Select from '$lib/components/basic/Select.svelte';
	import GroupSizeStepper from '$lib/components/onboarding/GroupSizeStepper.svelte';
	import { GROUP_SIZE, VENUE_LENGTH } from '$lib/constants/sessions';
	import { formatCents } from '$lib/utils/money';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const book = $derived(data.canBook ? data : null);

	// svelte-ignore state_referenced_locally
	let duration = $state(data.canBook ? data.defaultDuration : 60);
	// svelte-ignore state_referenced_locally
	let groupSize = $state(data.canBook ? Math.min(GROUP_SIZE.DEFAULT, data.maxGroupSize) : 1);
	// svelte-ignore state_referenced_locally
	let locationType = $state(data.canBook ? (data.locations[0]?.value ?? 'online') : 'online');
	let chapter = $state('');
	let dayKey = $state('');
	let startIso = $state('');
	let submitting = $state(false);

	/** Days that have at least one start time for the chosen length. */
	const days = $derived(
		(book?.days ?? [])
			.map((d) => ({ ...d, times: d.times.filter((t) => t.durations.includes(duration)) }))
			.filter((d) => d.times.length > 0)
	);
	const day = $derived(days.find((d) => d.key === dayKey) ?? days[0]);
	const startValid = $derived(!!day?.times.some((t) => t.iso === startIso));

	const isHome = $derived(locationType === 'student_home');
	const effectiveGroup = $derived(isHome ? 1 : groupSize);
	const ladder = $derived(book?.ladders[duration] ?? []);
	const solo = $derived(ladder[0]?.pricePerStudentCents ?? null);
	const full = $derived(
		ladder.find((s) => s.groupSize === effectiveGroup)?.pricePerStudentCents ?? null
	);

	const canSubmit = $derived(
		!!chapter && startValid && !(isHome && !book?.hasHomePostcode) && !submitting
	);
</script>

<svelte:head><title>Book a session · The Mind Club</title></svelte:head>

<div class="page">
	<a class="back" href={resolve(`/tutors/${data.tutor.id}`)}>← {data.tutor.name}'s profile</a>
	<h1>Book a session with {data.tutor.name}</h1>

	{#if !book}
		{#if data.reason === 'not_student'}
			<p>Only student accounts can book sessions.</p>
		{:else}
			<p>{data.tutor.name} isn't taking bookings yet.</p>
		{/if}
	{:else}
		<form
			method="POST"
			class="layout"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update({ reset: false });
					submitting = false;
				};
			}}
		>
			<input type="hidden" name="tutor" value={book.tutor.id} />

			<div class="fields">
				{#if form?.error}
					<Alert variant="error">{form.error}</Alert>
				{/if}

				<section>
					<label class="label" for="chapter">What do you want to cover?</label>
					{#if book.courses.length === 0}
						<p class="muted">{book.tutor.name} hasn't listed any chapters yet.</p>
					{:else}
						<Select id="chapter" name="chapter" bind:value={chapter} required>
							<option value="" disabled>Pick a chapter</option>
							{#each book.courses as c (c.key)}
								<optgroup label={c.label}>
									{#each c.chapters as ch (ch.value)}
										<option value={ch.value}>{ch.label}</option>
									{/each}
								</optgroup>
							{/each}
						</Select>
					{/if}
				</section>

				<section>
					<span class="label" id="length-label">Length</span>
					<div class="segmented" role="radiogroup" aria-labelledby="length-label">
						{#each book.durations as d (d)}
							<label class:selected={duration === d}>
								<input type="radio" name="durationMinutes" value={d} bind:group={duration} />
								{d === 60 ? '1 hour' : `${d / 60} hours`}
							</label>
						{/each}
					</div>
				</section>

				<section>
					<span class="label"
						>When <span class="zone"
							>({book.timeZone.split('/').pop()?.replace('_', ' ')} time)</span
						></span
					>
					{#if days.length === 0}
						<p class="muted">
							No {duration}-minute times free in the next four weeks. Try a shorter session.
						</p>
					{:else}
						<div class="picker">
							<ul class="days" aria-label="Day">
								{#each days as d (d.key)}
									<li>
										<button
											type="button"
											class:selected={d.key === day?.key}
											aria-pressed={d.key === day?.key}
											onclick={() => (dayKey = d.key)}
										>
											{d.label}
											<span class="count">{d.times.length}</span>
										</button>
									</li>
								{/each}
							</ul>
							<div class="times" role="radiogroup" aria-label="Start time">
								{#each day?.times ?? [] as t (t.iso)}
									<label class:selected={startIso === t.iso}>
										<input type="radio" name="startsAt" value={t.iso} bind:group={startIso} />
										{t.label}
									</label>
								{/each}
							</div>
						</div>
					{/if}
				</section>

				<section>
					<span class="label">Where</span>
					<div class="options" role="radiogroup">
						{#each book.locations as l (l.value)}
							<label class="option" class:selected={locationType === l.value}>
								<input type="radio" name="locationType" value={l.value} bind:group={locationType} />
								<span>{l.label}</span>
								{#if l.hint}<span class="muted small">{l.hint}</span>{/if}
							</label>
						{/each}
					</div>
					{#if locationType === 'public_venue'}
						<div class="venue">
							<label>
								<span class="small">Venue</span>
								<input
									name="venue"
									required
									minlength={VENUE_LENGTH.MIN}
									maxlength={VENUE_LENGTH.MAX}
									placeholder="e.g. State Library, level 2"
								/>
							</label>
							<label class="postcode">
								<span class="small">Postcode</span>
								<input
									name="venuePostcode"
									required
									inputmode="numeric"
									pattern={'\\d{4}'}
									maxlength="4"
								/>
							</label>
						</div>
					{/if}
					{#if locationType === 'online'}
						<p class="muted small">
							You'll get a Join button on the session page 15 minutes before it starts.
						</p>
					{/if}
				</section>

				<section>
					<span class="label">Group size</span>
					{#if isHome}
						<p class="muted small">Sessions at your home are always 1:1.</p>
						<input type="hidden" name="groupSize" value="1" />
					{:else if book.maxGroupSize === 1}
						<p class="muted small">{book.tutor.name} only teaches 1:1.</p>
						<input type="hidden" name="groupSize" value="1" />
					{:else}
						<GroupSizeStepper
							name="groupSize"
							bind:value={groupSize}
							min={1}
							max={book.maxGroupSize}
						/>
						<p class="muted small">
							{groupSize === 1
								? 'A private 1:1. Nobody else can join.'
								: 'Others can find and join this session until 24 hours before it starts.'}
						</p>
					{/if}
				</section>
			</div>

			<!-- the live price block: the one elevated element, amber for the drop -->
			<aside class="price-block" aria-label="Price">
				{#if solo === null}
					<p class="muted">Pricing isn't available right now.</p>
				{:else}
					<p class="price-title">You pay at most</p>
					<p class="price-now">{formatCents(solo)}</p>
					{#if full !== null && effectiveGroup > 1 && full < solo}
						<p class="drop">
							{formatCents(full)} each if {effectiveGroup} students join
						</p>
						<ul class="ladder">
							{#each ladder.filter((s) => s.groupSize <= effectiveGroup) as s (s.groupSize)}
								<li class:cheapest={s.groupSize === effectiveGroup}>
									<span>{s.groupSize === 1 ? 'Just you' : `${s.groupSize} students`}</span>
									<span class="ladder-price">{formatCents(s.pricePerStudentCents)}</span>
								</li>
							{/each}
						</ul>
					{/if}
					<p class="muted small">
						Per student for {duration} minutes, booking fee included. The more students join, the less
						everyone pays.
					</p>
				{/if}
				<button class="book" type="submit" disabled={!canSubmit}>
					{submitting ? 'Booking…' : 'Book session'}
				</button>
				<p class="muted small">No payment yet. You can leave until 24 hours before it starts.</p>
			</aside>
		</form>
	{/if}
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

	h1 {
		margin: 0;
		font-family: 'Source Serif 4', serif;
		font-size: 1.75rem;
		font-weight: 600;
	}

	p {
		margin: 0;
	}

	.back {
		color: var(--tm-green);
		font-weight: 500;
		font-size: 0.875rem;
		text-decoration: none;
	}

	.muted {
		color: var(--tm-muted);
	}

	.small {
		font-size: 0.8125rem;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 18rem;
		gap: 2rem;
		align-items: start;
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.label {
		font-size: 0.875rem;
		font-weight: 600;
	}

	.zone {
		font-weight: 400;
		color: var(--tm-muted);
	}

	input[type='radio'] {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	/* shared look for every pickable chip */
	.segmented label,
	.times label,
	.days button,
	.option {
		position: relative;
		border: 1px solid var(--tm-border);
		border-radius: 6px;
		background: var(--tm-surface);
		cursor: pointer;
		font: inherit;
		color: inherit;

		&:hover {
			background: var(--tm-surface-hover);
		}

		&.selected {
			border-color: var(--tm-green);
			box-shadow: inset 0 0 0 1px var(--tm-green);
		}

		&:has(input:focus-visible) {
			outline: 2px solid var(--tm-green);
			outline-offset: 2px;
		}
	}

	.segmented {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;

		label {
			padding: 0.375rem 0.875rem;
		}
	}

	.picker {
		display: grid;
		grid-template-columns: 11rem minmax(0, 1fr);
		gap: 1rem;
		align-items: start;
	}

	.days {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		max-height: 22rem;
		overflow-y: auto;

		button {
			width: 100%;
			display: flex;
			justify-content: space-between;
			padding: 0.5rem 0.75rem;
			text-align: left;
		}
	}

	.count {
		color: var(--tm-muted);
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
	}

	.times {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
		gap: 0.5rem;

		label {
			padding: 0.5rem;
			text-align: center;
			font-variant-numeric: tabular-nums;
		}
	}

	.options {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.option {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.625rem 0.75rem;
	}

	.venue {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 7rem;
		gap: 0.75rem;

		label {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
		}

		input {
			font: inherit;
			padding: 0.5rem 0.625rem;
			border: 1px solid var(--tm-border);
			border-radius: 6px;
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

	.ladder {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.875rem;

		li {
			display: flex;
			justify-content: space-between;
			font-variant-numeric: tabular-nums;
		}

		.cheapest .ladder-price {
			color: var(--tm-amber);
			font-weight: 600;
		}
	}

	.book {
		padding: 0.625rem 0.75rem;
		border: 0;
		border-radius: 6px;
		background: var(--tm-green);
		color: #fff;
		font: inherit;
		font-weight: 500;
		cursor: pointer;

		&:hover:not(:disabled) {
			background: var(--tm-green-hover);
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		&:focus-visible {
			outline: 2px solid var(--tm-green);
			outline-offset: 2px;
		}
	}

	@media (max-width: 820px) {
		.layout,
		.picker {
			grid-template-columns: 1fr;
		}

		.price-block {
			position: static;
		}

		.days {
			flex-direction: row;
			overflow-x: auto;
			max-height: none;

			button {
				white-space: nowrap;
				gap: 0.5rem;
			}
		}
	}
</style>
