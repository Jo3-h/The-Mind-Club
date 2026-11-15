<!--
	Public tutor search. Everything is a plain GET form, so the URL is the search: it works
	without JavaScript, survives refresh/back, and can be shared. With JS, any change re-runs
	the search (SvelteKit handles GET forms as client-side navigation).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { withQuery } from '$lib/utils/links';
	import TimeSlotPicker from '$lib/components/tutors/TimeSlotPicker.svelte';
	import TutorResultCard from '$lib/components/tutors/TutorResultCard.svelte';
	import { POSTCODE_DIGITS, STATES, YEAR_LEVELS } from '$lib/constants/profile';
	import { ANY_FILTER, SEARCH_MODES, SEARCH_MODE_LABELS } from '$lib/constants/search';
	import type { PageProps } from './$types';
	import Select from '$lib/components/basic/Select.svelte';
	import { slide } from 'svelte/transition';

	let { data }: PageProps = $props();

	let formEl = $state<HTMLFormElement | null>(null);

	// Logged-out visitors: search in the browser's timezone (logged-in users use their profile's).
	let browserTz = $state('');
	onMount(() => {
		if (!data.user && !data.filters.tz) {
			browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
		}
	});
	const tzField = $derived(data.filters.tz ?? (browserTz || null));

	function submitOnChange(e: Event) {
		// the postcode box submits on Enter/blur via its own change event, which is fine
		if (e.target instanceof HTMLElement && e.target.closest('form') === formEl) {
			formEl?.requestSubmit();
		}
	}

	const selectedCourse = $derived(data.courses.find((c) => c.key === data.filters.course));

	type CourseOption = (typeof data.courses)[number];
	/** "Year 11 Mathematical Methods (SA)" */
	const courseLabel = (c: CourseOption) =>
		`Year ${c.yearLevel} ${c.name} (${c.state ?? 'National'})`;
	const courseLabels = $derived(
		Object.fromEntries(data.courses.map((c) => [c.key, courseLabel(c)]))
	);

	/** "Year 11 SA Mathematics", built from whichever filters are set. */
	const scopeLabel = $derived(
		[data.filters.year ? `Year ${data.filters.year}` : null, data.filters.state, data.subjectName]
			.filter(Boolean)
			.join(' ')
	);

	/** Same search, different page. */
	const pageHref = (n: number) =>
		withQuery(resolve('/tutors'), page.url.searchParams, { page: String(n) });
	/** Profile link keeps the search, so "Back to results" can return to it. */
	const profileHref = (id: string) =>
		withQuery(resolve('/(public)/tutors/[tutorId]', { tutorId: id }), page.url.searchParams, {
			page: null
		});
</script>

<svelte:head><title>Find a tutor · The Mind Club</title></svelte:head>

<div class="page">
	<header class="page-header">
		<h1>Find a tutor</h1>
		<p class="subtitle">
			Choose a subject to see every tutor, then pick the course you're enrolled in and narrow by
			time and place. The more students join a group, the less everyone pays.
		</p>
	</header>

	<div class="layout">
		<!-- ================= FILTERS ================= -->
		<form
			class="filters"
			method="GET"
			action={resolve('/tutors')}
			bind:this={formEl}
			onchange={submitOnChange}
			data-sveltekit-keepfocus
			data-sveltekit-noscroll
			data-sveltekit-replacestate
		>
			{#if tzField}<input type="hidden" name="tz" value={tzField} />{/if}

			<fieldset class="group">
				<legend>How can we help you?</legend>
				<label class="field">
					<span>Subject</span>
					<Select name="subject" value={data.filters.subject ?? ''}>
						<option value="">Choose a subject</option>
						{#each data.subjects as s (s.key)}
							<option value={s.key}>{s.name}</option>
						{/each}
					</Select>
				</label>

				<div class="row">
					<label class="field">
						<span>
							State
							{#if data.prefilled.state}<em>from your profile</em>{/if}
						</span>
						<Select name="state" value={data.filters.state ?? ANY_FILTER}>
							<option value={ANY_FILTER}>Any state</option>
							{#each STATES as s (s)}
								<option value={s}>{s}</option>
							{/each}
						</Select>
					</label>
					<label class="field">
						<span>
							Year
							{#if data.prefilled.year}<em>from your profile</em>{/if}
						</span>
						<Select name="year" value={data.filters.year ? String(data.filters.year) : ANY_FILTER}>
							<option value={ANY_FILTER}>Any year</option>
							{#each YEAR_LEVELS as y (y)}
								<option value={String(y)}>Year {y}</option>
							{/each}
						</Select>
					</label>
				</div>

				{#if data.courses.length > 0}
					<label class="field">
						<span>Your course</span>
						<Select name="course" value={data.filters.course ?? ''}>
							<option value="">
								All {data.courses.length} matching course{data.courses.length === 1 ? '' : 's'}
							</option>
							{#each data.courses as c (c.key)}
								<option value={c.key}>{courseLabel(c)}</option>
							{/each}
						</Select>
						<small class="hint">
							{#if selectedCourse}
								{selectedCourse.topicCount} chapter{selectedCourse.topicCount === 1
									? ''
									: 's'}{#if selectedCourse.textbook}
									· {selectedCourse.textbook}{/if}
							{:else}
								Pick the course you're enrolled in to see only its tutors.
							{/if}
						</small>
					</label>
				{/if}
			</fieldset>

			<fieldset class="group">
				<legend>When are you available?</legend>
				{#if data.canUseMine}
					<label class="check">
						<input type="checkbox" name="mine" value="1" checked={data.filters.mine} />
						<span>Times I'm free (from my profile)</span>
					</label>
				{/if}
				<TimeSlotPicker selected={data.filters.when} />
				<small class="hint">
					Tutors must share at least an hour with what you pick. Times in {data.timeZone.replace(
						'Australia/',
						''
					)} time.
				</small>
			</fieldset>

			<fieldset class="group">
				<legend>Where</legend>
				<div class="segmented">
					{#each SEARCH_MODES as m (m)}
						<label>
							<input type="radio" name="mode" value={m} checked={data.filters.mode === m} />
							<span>{SEARCH_MODE_LABELS[m]}</span>
						</label>
					{/each}
				</div>
				{#if data.filters.mode !== 'online'}
					<label class="field">
						<span>Your postcode</span>
						<input
							name="postcode"
							inputmode="numeric"
							maxlength={POSTCODE_DIGITS}
							value={data.postcode?.value ?? ''}
							placeholder="e.g. 5000"
						/>
						{#if data.postcode && !data.postcode.known}
							<small class="hint warn"
								>We don't know that postcode yet, so distance isn't checked.</small
							>
						{:else if data.postcode?.suburb}
							<small class="hint">Near {data.postcode.suburb}</small>
						{:else}
							<small class="hint">So we only show in-person tutors who'll travel to you.</small>
						{/if}
					</label>
				{/if}
			</fieldset>

			<button type="submit" class="submit">Update results</button>
		</form>

		<!-- ================= RESULTS ================= -->
		<section class="results" aria-live="polite">
			{#if !data.filters.subject}
				<div class="empty">
					<p class="empty-title">Start with a subject</p>
					<p>
						We'll show every tutor for it straight away. Add your state and year, then pick your
						course to narrow down.
					</p>
				</div>
			{:else if data.courses.length === 0}
				<div class="empty">
					<p class="empty-title">No {scopeLabel} courses yet</p>
					<p>Try "Any year" or "Any state", or check back soon: courses are added regularly.</p>
				</div>
			{:else if !data.results}
				<div class="empty">
					<p class="empty-title">No chapters listed for these courses yet</p>
					<p>Tutors are matched on chapters, so there's no one to show until they're added.</p>
				</div>
			{:else}
				<div class="results-head">
					<h2>
						{data.results.total}
						{data.results.total === 1 ? 'tutor' : 'tutors'} for {selectedCourse
							? courseLabel(selectedCourse)
							: scopeLabel}
					</h2>
					{#if !selectedCourse && data.courses.length > 1}
						<span class="scope-note">across {data.courses.length} courses</span>
					{/if}
				</div>

				{#if data.results.total === 0}
					<div class="empty">
						<p class="empty-title">No tutors match all of that</p>
						<p>
							Try more time slots, "Online or in person", or all matching courses. Tutors are added
							every week.
						</p>
					</div>
				{:else}
					<ul class="list" transition:slide>
						{#each data.results.items as tutor (tutor.id)}
							<li transition:slide>
								<TutorResultCard {tutor} href={profileHref(tutor.id)} {courseLabels} />
							</li>
						{/each}
					</ul>

					{#if data.results.pageCount > 1}
						<nav class="pager" aria-label="Pages">
							{#if data.results.page > 1}
								<a href={pageHref(data.results.page - 1)}>← Previous</a>
							{:else}<span></span>{/if}
							<span>Page {data.results.page} of {data.results.pageCount}</span>
							{#if data.results.page < data.results.pageCount}
								<a href={pageHref(data.results.page + 1)}>Next →</a>
							{:else}<span></span>{/if}
						</nav>
					{/if}
				{/if}
			{/if}
		</section>
	</div>
</div>

<style>
	.page {
		width: 100%;
		max-width: 72rem;
		margin-inline: auto;
		padding: var(--gap-large);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		color: var(--tm-ink);
		font-size: 0.875rem;
	}

	h1 {
		margin: 0;
		font-size: 2rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.subtitle {
		margin: 0.375rem 0 0;
		color: var(--darkest-grey);
		max-width: 40rem;
		line-height: 1.5;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(17rem, 21rem) 1fr;
		gap: 2rem;
		align-items: start;
	}

	/* ---------- filters ---------- */
	.filters {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		position: sticky;
		top: 1rem;
	}

	.group {
		border: none;
		margin: 0;
		padding: 0 0 1.25rem;
		border-bottom: 1px solid var(--tm-border);
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		min-width: 0;

		legend {
			padding: 0;
			margin-bottom: 0.625rem;
			font-size: 0.6875rem;
			font-weight: 600;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			color: var(--tm-muted);
		}
	}

	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;

		& > span {
			font-size: 0.75rem;
			color: var(--tm-muted);
		}

		em {
			font-style: normal;
			color: var(--tm-green);
			margin-left: 0.25rem;
		}
	}

	input:not([type='radio']):not([type='checkbox']) {
		font: inherit;
		padding: 0.4375rem 0.5rem;
		border-radius: 6px;
		background: var(--tm-surface);
		color: inherit;
		min-width: 0;

		&:focus-visible {
			outline: none;
			border-color: var(--tm-green);
			box-shadow: 0 0 0 2px color-mix(in srgb, var(--tm-green) 20%, transparent);
		}
	}

	.check {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		cursor: pointer;

		input {
			margin-top: 0.15rem;
			accent-color: var(--tm-green);
		}
	}

	.segmented {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		border: 1px solid var(--tm-border);
		border-radius: 6px;
		padding: 2px;
		gap: 2px;

		label {
			position: relative;
			cursor: pointer;
		}

		input {
			position: absolute;
			opacity: 0;
		}

		span {
			display: block;
			text-align: center;
			padding: 0.375rem 0.25rem;
			border-radius: 4px;
			font-size: 0.75rem;
			color: var(--tm-muted);
		}

		input:checked + span {
			background: var(--tm-green);
			color: #fff;
		}

		input:focus-visible + span {
			outline: 2px solid var(--tm-green);
			outline-offset: 1px;
		}
	}

	.hint {
		font-size: 0.75rem;
		color: var(--tm-muted);

		&.warn {
			color: hsl(0, 55%, 42%);
		}
	}

	.submit {
		font: inherit;
		font-weight: 500;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--tm-green);
		border-radius: 6px;
		background: var(--tm-green);
		color: #fff;
		cursor: pointer;

		&:hover {
			background: var(--tm-green-hover);
		}
	}

	/* ---------- results ---------- */
	.results {
		display: flex;
		flex-direction: column;
		gap: var(--gap);
		min-width: 0;
	}

	.results-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;

		h2 {
			margin: 0;
			font-size: 1rem;
			font-weight: 600;
		}
	}

	.scope-note {
		font-size: 0.75rem;
		color: var(--tm-muted);
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--gap);

		li {
			border: 1px solid var(--tm-border);
			border-radius: 8px;
			overflow: hidden;
		}
	}

	.empty {
		padding: 2rem 1.5rem;
		border: 1px dashed var(--tm-border);
		border-radius: 8px;
		color: var(--tm-muted);

		p {
			margin: 0;
			line-height: 1.5;
		}
	}

	.empty-title {
		font-family: 'Source Serif 4', serif;
		font-size: 1.0625rem;
		color: var(--tm-ink);
		margin-bottom: 0.25rem !important;
	}

	.pager {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.8125rem;
		color: var(--tm-muted);

		a {
			color: var(--tm-green);
			font-weight: 500;
		}
	}

	@media (max-width: 820px) {
		.layout {
			grid-template-columns: 1fr;
		}

		.filters {
			position: static;
		}
	}
</style>
